import { HTMLElement, parse } from "node-html-parser";
import type { StyleMap } from "../contracts.js";

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

const INLINE_STYLE_ORDER = Number.MAX_SAFE_INTEGER;
const INLINE_STYLE_SPECIFICITY = Number.MAX_SAFE_INTEGER;

export function mergeHtmlWithCss(html: string, css: string): string {
  const normalizedHtml = html.trim();

  if (!normalizedHtml) {
    throw new Error("HTML content is required.");
  }

  if (!css.trim()) {
    return normalizedHtml;
  }

  const documentNode = parse(normalizedHtml, {
    blockTextElements: {
      script: false,
      noscript: false,
      style: false,
      pre: true
    }
  });
  const stylesheet = parseStylesheet(css);
  const appliedStyles = new Map<HTMLElement, Map<string, AppliedDeclaration>>();

  for (const rule of stylesheet) {
    for (const selector of rule.selectors) {
      const normalizedSelector = selector.trim();

      if (!normalizedSelector) {
        continue;
      }

      let matchedElements: HTMLElement[] = [];

      try {
        matchedElements = documentNode.querySelectorAll(normalizedSelector);
      } catch {
        continue;
      }

      const specificity = calculateSpecificity(normalizedSelector);

      for (const element of matchedElements) {
        const declarationsForElement =
          appliedStyles.get(element) ?? new Map<string, AppliedDeclaration>();

        for (const [property, value] of Object.entries(rule.declarations)) {
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

  for (const element of documentNode.querySelectorAll("*")) {
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

    if (declarationsForElement.size > 0) {
      element.setAttribute("style", serializeDeclarations(declarationsForElement));
    }
  }

  return documentNode.toString();
}

function parseStylesheet(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const normalizedCss = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null = rulePattern.exec(normalizedCss);
  let order = 0;

  while (match) {
    const selectors = match[1]
      .split(",")
      .map((selector) => selector.trim())
      .filter(Boolean);
    const declarations = parseDeclarationBlock(match[2]);

    if (selectors.length > 0 && Object.keys(declarations).length > 0) {
      rules.push({
        selectors,
        declarations,
        order
      });
      order += 1;
    }

    match = rulePattern.exec(normalizedCss);
  }

  return rules;
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
