import type { StyleMap } from "../contracts.js";

export interface StyleImplementationResult {
  customProperties: Map<string, string>;
  generatedFallbacks: Map<string, string>;
  resolvedStyles: StyleMap;
  warnings: string[];
}

export function implementStyleDeclarations(
  declarations: StyleMap,
  inheritedCustomProperties = new Map<string, string>()
): StyleImplementationResult {
  const warnings: string[] = [];
  const rawCustomProperties = Object.entries(declarations).filter(([property]) =>
    property.startsWith("--")
  );
  const generatedFallbacks = generateDefaultStyleTokenFallbacks(
    declarations,
    inheritedCustomProperties
  );
  const customProperties = new Map(inheritedCustomProperties);

  for (const [property, value] of generatedFallbacks) {
    if (customProperties.has(property)) {
      continue;
    }

    customProperties.set(property, value);
    warnings.push(
      `Generated default fallback for missing CSS token ${property}: ${value}.`
    );
  }

  for (const [property, value] of rawCustomProperties) {
    customProperties.set(
      property,
      resolveCssVariables(value, customProperties)
    );
  }

  const resolvedStyles = Object.entries(declarations).reduce<StyleMap>(
    (accumulator, [property, value]) => {
      if (property.startsWith("--")) {
        return accumulator;
      }

      const resolvedValue = resolveCssVariables(value, customProperties).trim();

      if (resolvedValue) {
        accumulator[property] = resolvedValue;
      }

      return accumulator;
    },
    {}
  );

  return {
    customProperties,
    generatedFallbacks,
    resolvedStyles,
    warnings
  };
}

export function generateDefaultStyleTokenFallbacks(
  declarations: StyleMap,
  availableCustomProperties = new Map<string, string>()
): Map<string, string> {
  const generatedFallbacks = new Map<string, string>();
  const localCustomProperties = new Set(
    Object.keys(declarations).filter((property) => property.startsWith("--"))
  );

  for (const [property, value] of Object.entries(declarations)) {
    collectMissingTokenFallbacks(
      value,
      property,
      availableCustomProperties,
      localCustomProperties,
      generatedFallbacks
    );
  }

  return generatedFallbacks;
}

function collectMissingTokenFallbacks(
  value: string,
  consumerProperty: string,
  availableCustomProperties: Map<string, string>,
  localCustomProperties: Set<string>,
  generatedFallbacks: Map<string, string>
) {
  for (const expression of extractVarExpressions(value)) {
    const [propertyName, explicitFallback] = splitVarExpression(expression);
    const normalizedPropertyName = propertyName?.trim();

    if (
      normalizedPropertyName &&
      !availableCustomProperties.has(normalizedPropertyName) &&
      !localCustomProperties.has(normalizedPropertyName) &&
      !generatedFallbacks.has(normalizedPropertyName) &&
      !explicitFallback
    ) {
      generatedFallbacks.set(
        normalizedPropertyName,
        inferDefaultTokenValue(normalizedPropertyName, consumerProperty)
      );
    }

    if (explicitFallback) {
      collectMissingTokenFallbacks(
        explicitFallback,
        consumerProperty,
        availableCustomProperties,
        localCustomProperties,
        generatedFallbacks
      );
    }
  }
}

function inferDefaultTokenValue(
  tokenName: string,
  consumerProperty: string
): string {
  const normalizedTokenName = tokenName.toLowerCase();
  const normalizedProperty = consumerProperty.toLowerCase();

  if (isShadowContext(normalizedTokenName, normalizedProperty)) {
    return "0 12px 24px rgba(15, 23, 42, 0.12)";
  }

  if (isRadiusContext(normalizedTokenName, normalizedProperty)) {
    return inferRadiusFallback(normalizedTokenName);
  }

  if (isSpacingContext(normalizedTokenName, normalizedProperty)) {
    return inferSpacingFallback(normalizedTokenName);
  }

  if (isFontSizeContext(normalizedTokenName, normalizedProperty)) {
    return inferFontSizeFallback(normalizedTokenName);
  }

  if (isLineHeightContext(normalizedTokenName, normalizedProperty)) {
    return inferLineHeightFallback(normalizedTokenName);
  }

  if (isFontWeightContext(normalizedTokenName, normalizedProperty)) {
    return inferFontWeightFallback(normalizedTokenName);
  }

  if (isLetterSpacingContext(normalizedTokenName, normalizedProperty)) {
    return "0px";
  }

  if (isOpacityContext(normalizedTokenName, normalizedProperty)) {
    return inferOpacityFallback(normalizedTokenName);
  }

  if (isColorContext(normalizedTokenName, normalizedProperty)) {
    return inferColorFallback(normalizedTokenName, normalizedProperty);
  }

  if (normalizedProperty === "display") {
    return "block";
  }

  if (normalizedProperty === "flex-direction") {
    return "row";
  }

  if (normalizedProperty === "justify-content") {
    return "flex-start";
  }

  if (normalizedProperty === "align-items" || normalizedProperty === "align-self") {
    return "stretch";
  }

  if (normalizedProperty === "overflow") {
    return "visible";
  }

  if (normalizedProperty === "background-image") {
    return "none";
  }

  if (
    normalizedProperty.endsWith("width") ||
    normalizedProperty.endsWith("height") ||
    normalizedProperty === "width" ||
    normalizedProperty === "height"
  ) {
    return "auto";
  }

  return "initial";
}

function inferColorFallback(tokenName: string, consumerProperty: string): string {
  if (/text|foreground|on-/.test(tokenName) || /color/.test(consumerProperty)) {
    if (/background/.test(consumerProperty)) {
      return "#ffffff";
    }

    return "#111827";
  }

  if (/danger|error|destructive/.test(tokenName)) {
    return "#dc2626";
  }

  if (/warning|caution/.test(tokenName)) {
    return "#d97706";
  }

  if (/success|positive/.test(tokenName)) {
    return "#16a34a";
  }

  if (/border|stroke|outline|divider/.test(tokenName) || /border/.test(consumerProperty)) {
    return "#d1d5db";
  }

  if (/background|surface|card|canvas|overlay/.test(tokenName)) {
    return tokenName.includes("overlay")
      ? "rgba(15, 23, 42, 0.6)"
      : "#ffffff";
  }

  if (/accent|brand|primary/.test(tokenName)) {
    return "#2563eb";
  }

  if (/secondary|muted|subtle/.test(tokenName)) {
    return "#64748b";
  }

  if (/inverse|on-/.test(tokenName)) {
    return "#ffffff";
  }

  return "#111827";
}

function inferRadiusFallback(tokenName: string): string {
  if (/full|pill|round|circle/.test(tokenName)) {
    return "999px";
  }

  if (/xs|2xs|xxs/.test(tokenName)) {
    return "4px";
  }

  if (/sm|small/.test(tokenName)) {
    return "8px";
  }

  if (/lg|large/.test(tokenName)) {
    return "16px";
  }

  if (/xl|2xl|3xl/.test(tokenName)) {
    return "24px";
  }

  return "12px";
}

function inferSpacingFallback(tokenName: string): string {
  if (/2xs|xxs/.test(tokenName)) {
    return "2px";
  }

  if (/\bxs\b|xsmall/.test(tokenName)) {
    return "4px";
  }

  if (/\bsm\b|small/.test(tokenName)) {
    return "8px";
  }

  if (/\bmd\b|medium/.test(tokenName)) {
    return "12px";
  }

  if (/\blg\b|large/.test(tokenName)) {
    return "16px";
  }

  if (/2xl|xxl/.test(tokenName)) {
    return "32px";
  }

  if (/\bxl\b/.test(tokenName)) {
    return "24px";
  }

  return "16px";
}

function inferFontSizeFallback(tokenName: string): string {
  if (/caption|label|2xs|xxs/.test(tokenName)) {
    return "12px";
  }

  if (/\bxs\b|small|sm/.test(tokenName)) {
    return "14px";
  }

  if (/title|heading|hero|display|3xl/.test(tokenName)) {
    return "32px";
  }

  if (/h2|2xl|xxl/.test(tokenName)) {
    return "28px";
  }

  if (/\bxl\b|subtitle|lead/.test(tokenName)) {
    return "20px";
  }

  if (/\blg\b|large/.test(tokenName)) {
    return "18px";
  }

  return "16px";
}

function inferLineHeightFallback(tokenName: string): string {
  if (/compact|tight|caption|label/.test(tokenName)) {
    return "20px";
  }

  if (/title|heading|hero|display/.test(tokenName)) {
    return "40px";
  }

  return "24px";
}

function inferFontWeightFallback(tokenName: string): string {
  if (/thin/.test(tokenName)) {
    return "200";
  }

  if (/light/.test(tokenName)) {
    return "300";
  }

  if (/medium/.test(tokenName)) {
    return "500";
  }

  if (/semibold|semi-bold/.test(tokenName)) {
    return "600";
  }

  if (/bold|strong/.test(tokenName)) {
    return "700";
  }

  return "400";
}

function inferOpacityFallback(tokenName: string): string {
  if (/disabled/.test(tokenName)) {
    return "0.5";
  }

  if (/muted|subtle|quiet/.test(tokenName)) {
    return "0.7";
  }

  return "1";
}

function isColorContext(tokenName: string, consumerProperty: string): boolean {
  return (
    /color|text|foreground|background|surface|fill|border|stroke|shadow|accent|brand/.test(
      tokenName
    ) ||
    /color|background|shadow|fill|stroke/.test(consumerProperty)
  );
}

function isShadowContext(tokenName: string, consumerProperty: string): boolean {
  return /shadow|elevation/.test(tokenName) || consumerProperty === "box-shadow";
}

function isRadiusContext(tokenName: string, consumerProperty: string): boolean {
  return /radius|round/.test(tokenName) || consumerProperty === "border-radius";
}

function isSpacingContext(tokenName: string, consumerProperty: string): boolean {
  return (
    /space|spacing|gap|padding|margin|inset/.test(tokenName) ||
    /gap|padding|margin|top|right|bottom|left|inset/.test(consumerProperty)
  );
}

function isFontSizeContext(tokenName: string, consumerProperty: string): boolean {
  return /font-size|text-size|type-scale|heading|title|body/.test(tokenName) ||
    consumerProperty === "font-size";
}

function isLineHeightContext(tokenName: string, consumerProperty: string): boolean {
  return /line-height|leading/.test(tokenName) || consumerProperty === "line-height";
}

function isFontWeightContext(tokenName: string, consumerProperty: string): boolean {
  return /weight|bold|strong|medium|light/.test(tokenName) ||
    consumerProperty === "font-weight";
}

function isLetterSpacingContext(tokenName: string, consumerProperty: string): boolean {
  return /tracking|letter-spacing|kerning/.test(tokenName) ||
    consumerProperty === "letter-spacing";
}

function isOpacityContext(tokenName: string, consumerProperty: string): boolean {
  return /opacity|alpha/.test(tokenName) || consumerProperty === "opacity";
}

export function resolveCssVariables(
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

function extractVarExpressions(value: string): string[] {
  const expressions: string[] = [];

  for (let index = 0; index < value.length; index += 1) {
    if (!value.startsWith("var(", index)) {
      continue;
    }

    const closingIndex = findMatchingParenthesis(value, index + 3);

    if (closingIndex < 0) {
      continue;
    }

    expressions.push(value.slice(index + 4, closingIndex));
    index = closingIndex;
  }

  return expressions;
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
