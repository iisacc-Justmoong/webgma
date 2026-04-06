import { HTMLElement } from "node-html-parser";
import type { StyleMap } from "../contracts.js";
import { loadCssContent } from "./css-content-loader.js";

interface CssRule {
  declarations: StyleMap;
  order: number;
  selectors: string[];
}

interface AppliedDeclaration {
  order: number;
  specificity: number;
  value: string;
}

interface ParsedStylesheet {
  rules: CssRule[];
  warnings: string[];
}

export interface InlineHtmlMergeResult {
  mergedHtml: string;
  warnings: string[];
}

const INLINE_STYLE_ORDER = Number.MAX_SAFE_INTEGER;
const INLINE_STYLE_SPECIFICITY = Number.MAX_SAFE_INTEGER;
const FLATTENABLE_AT_RULES = new Set([
  "@container",
  "@layer",
  "@media",
  "@scope",
  "@starting-style",
  "@supports"
]);
const DYNAMIC_PSEUDO_PATTERN =
  /:(active|focus|focus-visible|focus-within|hover|link|target|visited)\b(?:\([^)]*\))?/g;
const PSEUDO_ELEMENT_PATTERN = /::?(after|before|first-letter|first-line)\b/g;
const FUNCTION_PSEUDO_PATTERN = /:(is|where)\(([^()]+)\)/g;

export function mergeHtmlWithCss(html: string, css: string): string {
  return mergeHtmlWithCssWithDiagnostics(html, css).mergedHtml;
}

export function mergeHtmlWithCssWithDiagnostics(
  html: string,
  css: string
): InlineHtmlMergeResult {
  const loadedCss = loadCssContent(html, css);
  const documentNode = loadedCss.documentNode;
  const combinedCss = loadedCss.css;

  if (!combinedCss.trim()) {
    return {
      mergedHtml: documentNode.toString(),
      warnings: [...loadedCss.warnings]
    };
  }

  const stylesheet = parseStylesheet(combinedCss);
  const appliedStyles = new Map<HTMLElement, Map<string, AppliedDeclaration>>();
  const warnings = [...loadedCss.warnings, ...stylesheet.warnings];

  for (const rule of stylesheet.rules) {
    for (const selector of rule.selectors) {
      const normalizedSelector = selector.trim();

      if (!normalizedSelector) {
        continue;
      }

      const selectorCandidate = resolveInlineSelector(normalizedSelector, warnings);

      if (!selectorCandidate) {
        addWarning(
          warnings,
          `Unsupported selector skipped during CSS inlining: ${normalizedSelector}.`
        );
        continue;
      }

      let matchedElements: HTMLElement[] = [];

      if (selectorCandidate.targetsDocumentRoot) {
        matchedElements = findDocumentRootTargets(documentNode);
      } else {
        try {
          matchedElements = documentNode.querySelectorAll(selectorCandidate.selector);
        } catch {
          addWarning(
            warnings,
            `Unsupported selector skipped during CSS inlining: ${normalizedSelector}.`
          );
          continue;
        }
      }

      const specificity = calculateSpecificity(selectorCandidate.selector);

      for (const element of matchedElements) {
        const declarationsForElement =
          appliedStyles.get(element) ?? new Map<string, AppliedDeclaration>();

        for (const [property, value] of Object.entries(
          selectorCandidate.stripGeneratedContent
            ? omitGeneratedContent(rule.declarations)
            : rule.declarations
        )) {
          const currentDeclaration = declarationsForElement.get(property);

          if (
            !currentDeclaration ||
            specificity > currentDeclaration.specificity ||
            (specificity === currentDeclaration.specificity &&
              rule.order >= currentDeclaration.order)
          ) {
            declarationsForElement.set(property, {
              value,
              specificity,
              order: rule.order
            });
          }
        }

        appliedStyles.set(element, declarationsForElement);
      }
    }
  }

  mergeInlineStyles(documentNode, appliedStyles);

  return {
    mergedHtml: documentNode.toString(),
    warnings
  };
}

function parseStylesheet(css: string): ParsedStylesheet {
  const rules: CssRule[] = [];
  const warnings: string[] = [];
  const normalizedCss = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let order = 0;
  let cursor = 0;

  while (cursor < normalizedCss.length) {
    cursor = skipWhitespace(normalizedCss, cursor);

    if (cursor >= normalizedCss.length) {
      break;
    }

    if (normalizedCss[cursor] === "@") {
      const atRule = skipAtRule(normalizedCss, cursor);

      addWarningForAtRule(warnings, atRule.name, atRule.body);

      if (FLATTENABLE_AT_RULES.has(atRule.name) && atRule.body) {
        const nestedStylesheet = parseStylesheet(atRule.body);

        for (const rule of nestedStylesheet.rules) {
          rules.push({
            ...rule,
            order: rule.order + order
          });
        }

        order += nestedStylesheet.rules.length;

        for (const warning of nestedStylesheet.warnings) {
          addWarning(warnings, warning);
        }
      }

      cursor = atRule.nextIndex;
      continue;
    }

    const blockStart = findNextBlockStart(normalizedCss, cursor);

    if (blockStart < 0) {
      addWarning(
        warnings,
        "Unsupported CSS fragment skipped during CSS inlining."
      );
      break;
    }

    const selectorBlock = normalizedCss.slice(cursor, blockStart).trim();
    const blockEnd = findMatchingBrace(normalizedCss, blockStart);

    if (blockEnd < 0) {
      addWarning(
        warnings,
        `Malformed CSS rule skipped during CSS inlining: ${truncateForWarning(selectorBlock)}.`
      );
      break;
    }

    const declarationBlock = normalizedCss.slice(blockStart + 1, blockEnd).trim();

    if (declarationBlock.includes("{")) {
      addWarning(
        warnings,
        `Unsupported nested CSS rule skipped during CSS inlining: ${truncateForWarning(selectorBlock)}.`
      );
      cursor = blockEnd + 1;
      continue;
    }

    const selectors = selectorBlock
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean);
    const declarations = parseDeclarationBlock(declarationBlock);

    if (selectors.length === 0) {
      addWarning(
        warnings,
        "Unsupported CSS fragment skipped during CSS inlining."
      );
      cursor = blockEnd + 1;
      continue;
    }

    if (Object.keys(declarations).length === 0) {
      addWarning(
        warnings,
        `CSS rule without declarations skipped during CSS inlining: ${truncateForWarning(selectorBlock)}.`
      );
      cursor = blockEnd + 1;
      continue;
    }

    rules.push({
      selectors,
      declarations,
      order
    });
    order += 1;
    cursor = blockEnd + 1;
  }

  return {
    rules,
    warnings
  };
}


function parseDeclarationBlock(block: string): StyleMap {
  return block
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .reduce<StyleMap>((accumulator, declaration) => {
      const separatorIndex = declaration.indexOf(":");

      if (separatorIndex < 0) {
        return accumulator;
      }

      const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
      const value = declaration.slice(separatorIndex + 1).trim();

      if (property && value) {
        accumulator[property] = value;
      }

      return accumulator;
    }, {});
}

function serializeDeclarations(
  declarations: Map<string, AppliedDeclaration>
): string {
  return [...declarations.entries()]
    .sort((leftEntry, rightEntry) => leftEntry[1].order - rightEntry[1].order)
    .map(([property, declaration]) => `${property}: ${declaration.value}`)
    .join("; ");
}

function calculateSpecificity(selector: string): number {
  const normalizedSelector = selector.replace(/::?[\w-]+(\([^)]*\))?/g, "");
  const idCount = (normalizedSelector.match(/#[\w-]+/g) ?? []).length;
  const classCount =
    (normalizedSelector.match(/\.[\w-]+/g) ?? []).length +
    (normalizedSelector.match(/\[[^\]]+\]/g) ?? []).length;
  const elementCount = normalizedSelector
    .split(/[\s>+~]+/)
    .map((token) =>
      token
        .trim()
        .replace(/#[\w-]+/g, "")
        .replace(/\.[\w-]+/g, "")
        .replace(/\[[^\]]+\]/g, "")
    )
    .filter((token) => token && token !== "*").length;

  return idCount * 100 + classCount * 10 + elementCount;
}

function resolveInlineSelector(selector: string, warnings: string[]) {
  const exactSelector = selector.trim();
  let normalizedSelector = exactSelector;
  let stripGeneratedContent = false;
  let targetsDocumentRoot = false;

  PSEUDO_ELEMENT_PATTERN.lastIndex = 0;

  if (PSEUDO_ELEMENT_PATTERN.test(normalizedSelector)) {
    PSEUDO_ELEMENT_PATTERN.lastIndex = 0;
    normalizedSelector = normalizedSelector.replace(PSEUDO_ELEMENT_PATTERN, "");
    stripGeneratedContent = true;
    addWarning(
      warnings,
      `Pseudo-element selector flattened onto the base element during CSS inlining: ${exactSelector}.`
    );
  }

  DYNAMIC_PSEUDO_PATTERN.lastIndex = 0;

  if (DYNAMIC_PSEUDO_PATTERN.test(normalizedSelector)) {
    DYNAMIC_PSEUDO_PATTERN.lastIndex = 0;
    normalizedSelector = normalizedSelector.replace(DYNAMIC_PSEUDO_PATTERN, "");
    addWarning(
      warnings,
      `State selector flattened onto the base element during CSS inlining: ${exactSelector}.`
    );
  }

  FUNCTION_PSEUDO_PATTERN.lastIndex = 0;

  if (FUNCTION_PSEUDO_PATTERN.test(normalizedSelector)) {
    FUNCTION_PSEUDO_PATTERN.lastIndex = 0;
    normalizedSelector = normalizedSelector.replace(
      FUNCTION_PSEUDO_PATTERN,
      (_, pseudoName: string, innerSelector: string) => {
        const normalizedInnerSelector = innerSelector.trim();

        if (!normalizedInnerSelector || normalizedInnerSelector.includes(",")) {
          addWarning(
            warnings,
            `Unsupported functional selector skipped during CSS inlining: ${exactSelector}.`
          );

          return `:${pseudoName}(${innerSelector})`;
        }

        addWarning(
          warnings,
          `Functional selector flattened onto the base selector during CSS inlining: ${exactSelector}.`
        );

        return normalizedInnerSelector;
      }
    );
  }

  if (normalizedSelector === ":root") {
    normalizedSelector = "html";
    targetsDocumentRoot = true;
    addWarning(
      warnings,
      `Root selector normalized during CSS inlining: ${exactSelector}.`
    );
  } else if (normalizedSelector.includes(":root")) {
    normalizedSelector = normalizedSelector.replace(/:root/g, "html");
    addWarning(
      warnings,
      `Root selector normalized during CSS inlining: ${exactSelector}.`
    );
  }

  normalizedSelector = collapseSelectorWhitespace(normalizedSelector);

  if (!normalizedSelector || normalizedSelector === "*") {
    return null;
  }

  return {
    selector: normalizedSelector,
    stripGeneratedContent,
    targetsDocumentRoot
  };
}

function skipWhitespace(source: string, startIndex: number): number {
  let cursor = startIndex;

  while (cursor < source.length && /\s/.test(source[cursor])) {
    cursor += 1;
  }

  return cursor;
}

function findNextBlockStart(source: string, startIndex: number): number {
  let quoteCharacter: '"' | "'" | null = null;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];

    if (quoteCharacter) {
      if (character === "\\") {
        index += 1;
        continue;
      }

      if (character === quoteCharacter) {
        quoteCharacter = null;
      }

      continue;
    }

    if (character === '"' || character === "'") {
      quoteCharacter = character;
      continue;
    }

    if (character === "{") {
      return index;
    }

    if (character === "}") {
      return -1;
    }
  }

  return -1;
}

function findMatchingBrace(source: string, openingBraceIndex: number): number {
  let depth = 0;
  let quoteCharacter: '"' | "'" | null = null;

  for (let index = openingBraceIndex; index < source.length; index += 1) {
    const character = source[index];

    if (quoteCharacter) {
      if (character === "\\") {
        index += 1;
        continue;
      }

      if (character === quoteCharacter) {
        quoteCharacter = null;
      }

      continue;
    }

    if (character === '"' || character === "'") {
      quoteCharacter = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function skipAtRule(source: string, startIndex: number) {
  const nameMatch = /^@[\w-]+/.exec(source.slice(startIndex));
  const name = nameMatch?.[0] ?? "@unknown";
  let cursor = startIndex + name.length;

  while (cursor < source.length && /\s/.test(source[cursor])) {
    cursor += 1;
  }

  while (cursor < source.length && source[cursor] !== ";" && source[cursor] !== "{") {
    cursor += 1;
  }

  if (cursor >= source.length) {
    return {
      name,
      body: "",
      nextIndex: source.length
    };
  }

  if (source[cursor] === ";") {
    return {
      name,
      body: "",
      nextIndex: cursor + 1
    };
  }

  const blockEnd = findMatchingBrace(source, cursor);

  return {
    name,
    body: blockEnd >= 0 ? source.slice(cursor + 1, blockEnd) : "",
    nextIndex: blockEnd >= 0 ? blockEnd + 1 : source.length
  };
}

function addWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}

function truncateForWarning(value: string): string {
  const normalizedValue = value.replace(/\s+/g, " ").trim();

  if (normalizedValue.length <= 60) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 57)}...`;
}

function addWarningForAtRule(
  warnings: string[],
  atRuleName: string,
  atRuleBody: string
) {
  if (FLATTENABLE_AT_RULES.has(atRuleName)) {
    addWarning(
      warnings,
      `Conditional at-rule flattened during CSS inlining: ${atRuleName}.`
    );
    return;
  }

  addWarning(
    warnings,
    `Unsupported at-rule skipped during CSS inlining: ${atRuleName}.`
  );

  if (atRuleBody.includes("{")) {
    addWarning(
      warnings,
      `Nested CSS inside ${atRuleName} could not be inlined directly.`
    );
  }
}

function collapseSelectorWhitespace(selector: string): string {
  return selector
    .replace(/\s+/g, " ")
    .replace(/\s*([>+~])\s*/g, " $1 ")
    .trim()
    .replace(/\s+(?=[>+~])/g, "")
    .replace(/([>+~])\s+/g, "$1");
}

function omitGeneratedContent(declarations: StyleMap): StyleMap {
  const nextDeclarations: StyleMap = {};

  for (const [property, value] of Object.entries(declarations)) {
    if (property === "content") {
      continue;
    }

    nextDeclarations[property] = value;
  }

  return nextDeclarations;
}


function findDocumentRootTargets(documentNode: HTMLElement): HTMLElement[] {
  const htmlElement = documentNode.querySelector("html");

  if (htmlElement) {
    return [htmlElement];
  }

  return documentNode.childNodes.filter(
    (childNode): childNode is HTMLElement => childNode instanceof HTMLElement
  );
}

function mergeInlineStyles(
  documentNode: HTMLElement,
  appliedStyles: Map<HTMLElement, Map<string, AppliedDeclaration>>
) {
  const inheritedCustomProperties = new Map<string, string>();

  for (const childNode of documentNode.childNodes) {
    if (childNode instanceof HTMLElement) {
      applyResolvedStylesRecursively(
        childNode,
        appliedStyles,
        inheritedCustomProperties
      );
    }
  }
}

function applyResolvedStylesRecursively(
  element: HTMLElement,
  appliedStyles: Map<HTMLElement, Map<string, AppliedDeclaration>>,
  inheritedCustomProperties: Map<string, string>
) {
  const declarationsForElement =
    appliedStyles.get(element) ?? new Map<string, AppliedDeclaration>();
  const inlineStyles = parseDeclarationBlock(element.getAttribute("style") ?? "");

  for (const [property, value] of Object.entries(inlineStyles)) {
    declarationsForElement.set(property, {
      value,
      specificity: INLINE_STYLE_SPECIFICITY,
      order: INLINE_STYLE_ORDER
    });
  }

  const resolvedCustomProperties = new Map(inheritedCustomProperties);

  for (const [property, declaration] of getDeclarationsInOrder(declarationsForElement)) {
    if (!property.startsWith("--")) {
      continue;
    }

    resolvedCustomProperties.set(
      property,
      resolveCssVariables(declaration.value, resolvedCustomProperties)
    );
  }

  const serializedDeclarations = getDeclarationsInOrder(declarationsForElement)
    .filter(([property]) => !property.startsWith("--"))
    .map(([property, declaration]) => ({
      property,
      order: declaration.order,
      value: resolveCssVariables(declaration.value, resolvedCustomProperties)
    }))
    .filter((declaration) => declaration.value.trim().length > 0)
    .sort((left, right) => left.order - right.order)
    .map((declaration) => `${declaration.property}: ${declaration.value}`)
    .join("; ");

  if (serializedDeclarations) {
    element.setAttribute("style", serializedDeclarations);
  } else if (element.hasAttribute("style")) {
    element.removeAttribute("style");
  }

  for (const childNode of element.childNodes) {
    if (childNode instanceof HTMLElement) {
      applyResolvedStylesRecursively(
        childNode,
        appliedStyles,
        resolvedCustomProperties
      );
    }
  }
}

function getDeclarationsInOrder(
  declarations: Map<string, AppliedDeclaration>
): Array<[string, AppliedDeclaration]> {
  return [...declarations.entries()].sort(
    (leftEntry, rightEntry) => leftEntry[1].order - rightEntry[1].order
  );
}

function resolveCssVariables(
  value: string,
  customProperties: Map<string, string>,
  seenProperties = new Set<string>()
): string {
  let resolvedValue = value;
  let guard = 0;

  while (resolvedValue.includes("var(") && guard < 32) {
    const nextValue = resolveSingleVariablePass(
      resolvedValue,
      customProperties,
      seenProperties
    );

    if (nextValue === resolvedValue) {
      break;
    }

    resolvedValue = nextValue;
    guard += 1;
  }

  return resolvedValue;
}

function resolveSingleVariablePass(
  value: string,
  customProperties: Map<string, string>,
  seenProperties: Set<string>
): string {
  let result = "";

  for (let index = 0; index < value.length; index += 1) {
    if (!value.startsWith("var(", index)) {
      result += value[index];
      continue;
    }

    const closingIndex = findMatchingParenthesis(value, index + 3);

    if (closingIndex < 0) {
      result += value[index];
      continue;
    }

    const expression = value.slice(index + 4, closingIndex);
    const [propertyName, fallbackValue] = splitVarExpression(expression);
    const resolvedProperty = propertyName
      ? resolveCustomPropertyValue(propertyName, customProperties, seenProperties)
      : undefined;
    const nextValue =
      resolvedProperty ??
      (fallbackValue
        ? resolveCssVariables(fallbackValue, customProperties, seenProperties)
        : `var(${expression})`);

    result += nextValue;
    index = closingIndex;
  }

  return result;
}

function resolveCustomPropertyValue(
  propertyName: string,
  customProperties: Map<string, string>,
  seenProperties: Set<string>
): string | undefined {
  const normalizedPropertyName = propertyName.trim();

  if (!normalizedPropertyName || seenProperties.has(normalizedPropertyName)) {
    return undefined;
  }

  const rawValue = customProperties.get(normalizedPropertyName);

  if (rawValue === undefined) {
    return undefined;
  }

  seenProperties.add(normalizedPropertyName);
  const resolvedValue = resolveCssVariables(rawValue, customProperties, seenProperties);
  seenProperties.delete(normalizedPropertyName);

  return resolvedValue;
}

function splitVarExpression(expression: string): [string | undefined, string | undefined] {
  let depth = 0;

  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];

    if (character === "(") {
      depth += 1;
      continue;
    }

    if (character === ")") {
      depth = Math.max(depth - 1, 0);
      continue;
    }

    if (character === "," && depth === 0) {
      return [
        expression.slice(0, index).trim(),
        expression.slice(index + 1).trim()
      ];
    }
  }

  return [expression.trim(), undefined];
}

function findMatchingParenthesis(source: string, openingIndex: number): number {
  let depth = 0;

  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];

    if (character === "(") {
      depth += 1;
      continue;
    }

    if (character === ")") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}
