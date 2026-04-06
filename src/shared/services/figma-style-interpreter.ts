import type { HTMLElement } from "node-html-parser";
import type {
  AppearanceHints,
  ColorHint,
  FontStyleHint,
  ImageHint,
  ItemLayoutHints,
  LayoutHints,
  PaddingHints,
  ShadowHint,
  StyleMap,
  StrokeHint,
  TextHints,
  TextSegmentHints
} from "../contracts.js";

export interface FigmaFrameStyleInterpretation {
  appearance: AppearanceHints;
  item: ItemLayoutHints;
  layout: LayoutHints;
}

export interface FigmaTextStyleInterpretation {
  appearance: AppearanceHints;
  item: ItemLayoutHints;
  layout: LayoutHints;
  text: TextHints;
}

export interface FigmaImageStyleInterpretation {
  appearance: AppearanceHints;
  item: ItemLayoutHints;
  layout: LayoutHints;
}

export function parseInlineStyle(styleText: string): StyleMap {
  return styleText
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

export function pickTextStyles(styles: StyleMap): StyleMap {
  const textProperties = [
    "color",
    "font-size",
    "font-style",
    "font-weight",
    "font-family",
    "line-height",
    "letter-spacing",
    "text-align",
    "width",
    "min-width",
    "max-width",
    "height",
    "min-height",
    "max-height",
    "opacity"
  ];

  return textProperties.reduce<StyleMap>((accumulator, key) => {
    const value = styles[key];

    if (value) {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
}

export function mergeTextStyles(
  inheritedStyles: StyleMap,
  tagName: string,
  styles: StyleMap
): StyleMap {
  return {
    ...inheritedStyles,
    ...deriveSemanticTextStyles(tagName),
    ...pickTextStyles(styles)
  };
}

export function reinterpretFrameStylesForFigma(
  styles: StyleMap,
  childCount: number,
  isRoot: boolean
): FigmaFrameStyleInterpretation {
  return {
    layout: deriveLayout(styles, childCount, isRoot),
    item: deriveItemLayout(styles),
    appearance: deriveAppearance(styles)
  };
}

export function reinterpretTextStylesForFigma(
  styles: StyleMap,
  segments: TextSegmentHints[]
): FigmaTextStyleInterpretation {
  return {
    layout: {
      mode: "NONE",
      gap: 0,
      crossGap: 0,
      wrap: "NO_WRAP",
      padding: emptyPadding(),
      width: parseLengthValue(styles.width),
      height: parseLengthValue(styles.height),
      minWidth: parseLengthValue(styles["min-width"]),
      maxWidth: parseLengthValue(styles["max-width"]),
      minHeight: parseLengthValue(styles["min-height"]),
      maxHeight: parseLengthValue(styles["max-height"]),
      clipsContent: false,
      justifyContent: "FLEX_START",
      alignItems: "FLEX_START"
    },
    item: deriveItemLayout(styles),
    appearance: {
      fills: parseTextFills(styles),
      shadows: [],
      strokes: [],
      opacity: parseNumber(styles.opacity)
    },
    text: deriveTextHints(styles, segments)
  };
}

export function reinterpretTextSegmentStylesForFigma(
  styles: StyleMap
): Omit<TextSegmentHints, "end" | "start"> {
  return {
    fills: parseTextFills(styles),
    fontSize: parseLengthValue(styles["font-size"]),
    fontStyle: parseFontStyle(styles["font-style"]),
    fontWeight: parseNumber(styles["font-weight"]),
    lineHeight: parseLengthValue(styles["line-height"]),
    letterSpacing: parseLengthValue(styles["letter-spacing"])
  };
}

export function reinterpretImageStylesForFigma(
  element: HTMLElement,
  styles: StyleMap
): FigmaImageStyleInterpretation {
  const width =
    parseLengthValue(styles.width) ??
    parseNumberAttribute(element, "width") ??
    160;
  const height =
    parseLengthValue(styles.height) ??
    parseNumberAttribute(element, "height") ??
    120;
  const image = createImageHint(
    element.getAttribute("src"),
    styles["object-fit"],
    element.getAttribute("alt") ?? undefined
  );

  return {
    layout: {
      mode: "NONE",
      gap: 0,
      crossGap: 0,
      wrap: "NO_WRAP",
      padding: emptyPadding(),
      width,
      height,
      minWidth: parseLengthValue(styles["min-width"]),
      maxWidth: parseLengthValue(styles["max-width"]),
      minHeight: parseLengthValue(styles["min-height"]),
      maxHeight: parseLengthValue(styles["max-height"]),
      clipsContent: parseClipsContent(styles),
      justifyContent: "FLEX_START",
      alignItems: "FLEX_START"
    },
    item: deriveItemLayout(styles),
    appearance: {
      ...deriveAppearance(styles),
      image
    }
  };
}

function deriveLayout(
  styles: StyleMap,
  childCount: number,
  isRoot: boolean
): LayoutHints {
  const display = styles.display?.toLowerCase();
  const flexDirection = styles["flex-direction"]?.toLowerCase() ?? "row";
  const gap = parseGap(styles);
  const mode =
    display === "flex"
      ? flexDirection.startsWith("column")
        ? "VERTICAL"
        : "HORIZONTAL"
      : childCount > 0 || isRoot
        ? "VERTICAL"
        : "NONE";

  return {
    mode,
    gap: mode === "VERTICAL" ? gap.row : gap.column,
    crossGap: mode === "VERTICAL" ? gap.column : gap.row,
    wrap:
      display === "flex" && styles["flex-wrap"]?.toLowerCase() === "wrap"
        ? "WRAP"
        : "NO_WRAP",
    padding: parsePadding(styles.padding, styles),
    width: parseLengthValue(styles.width),
    height: parseLengthValue(styles.height),
    minWidth: parseLengthValue(styles["min-width"]),
    maxWidth: parseLengthValue(styles["max-width"]),
    minHeight: parseLengthValue(styles["min-height"]),
    maxHeight: parseLengthValue(styles["max-height"]),
    clipsContent: parseClipsContent(styles),
    justifyContent: mapJustifyContent(styles["justify-content"]),
    alignItems: mapAlignItems(styles["align-items"])
  };
}

function deriveItemLayout(styles: StyleMap): ItemLayoutHints {
  const flexShorthand = parseFlexShorthand(styles.flex);

  return {
    margin: parsePadding(styles.margin, {
      "padding-top": styles["margin-top"],
      "padding-right": styles["margin-right"],
      "padding-bottom": styles["margin-bottom"],
      "padding-left": styles["margin-left"]
    }),
    alignSelf: mapAlignSelf(styles["align-self"]),
    flexGrow: parseNumber(styles["flex-grow"]) ?? flexShorthand.flexGrow ?? 0,
    flexShrink: parseNumber(styles["flex-shrink"]) ?? flexShorthand.flexShrink ?? 1,
    flexBasis: parseLengthValue(styles["flex-basis"]) ?? flexShorthand.flexBasis,
    position:
      styles.position?.trim().toLowerCase() === "absolute"
        ? "ABSOLUTE"
        : "AUTO",
    inset: parseInsets(styles),
    zIndex: parseNumber(styles["z-index"])
  };
}

function deriveAppearance(styles: StyleMap): AppearanceHints {
  return {
    fills: deriveBackgroundFills(styles),
    image: parseBackgroundImage(styles),
    shadows: parseBoxShadow(styles["box-shadow"]),
    strokes: parseBorder(styles),
    cornerRadius: parseLengthValue(styles["border-radius"]),
    opacity: parseNumber(styles.opacity)
  };
}

function deriveTextHints(
  styles: StyleMap,
  segments: TextSegmentHints[]
): TextHints {
  return {
    fontSize: parseLengthValue(styles["font-size"]),
    fontStyle: parseFontStyle(styles["font-style"]),
    fontWeight: parseNumber(styles["font-weight"]),
    lineHeight: parseLengthValue(styles["line-height"]),
    letterSpacing: parseLengthValue(styles["letter-spacing"]),
    segments,
    textAlign: mapTextAlign(styles["text-align"])
  };
}

function deriveSemanticTextStyles(tagName: string): StyleMap {
  switch (tagName) {
    case "b":
    case "strong":
      return {
        "font-weight": "700"
      };
    case "em":
    case "i":
      return {
        "font-style": "italic"
      };
    default:
      return {};
  }
}

function parsePadding(shorthand: string | undefined, styles: StyleMap): PaddingHints {
  if (shorthand) {
    const paddingValues = shorthand
      .trim()
      .split(/\s+/)
      .map((value) => parseLengthValue(value) ?? 0);

    if (paddingValues.length === 1) {
      return {
        top: paddingValues[0],
        right: paddingValues[0],
        bottom: paddingValues[0],
        left: paddingValues[0]
      };
    }

    if (paddingValues.length === 2) {
      return {
        top: paddingValues[0],
        right: paddingValues[1],
        bottom: paddingValues[0],
        left: paddingValues[1]
      };
    }

    if (paddingValues.length === 3) {
      return {
        top: paddingValues[0],
        right: paddingValues[1],
        bottom: paddingValues[2],
        left: paddingValues[1]
      };
    }

    if (paddingValues.length >= 4) {
      return {
        top: paddingValues[0],
        right: paddingValues[1],
        bottom: paddingValues[2],
        left: paddingValues[3]
      };
    }
  }

  return {
    top: parseLengthValue(styles["padding-top"]) ?? 0,
    right: parseLengthValue(styles["padding-right"]) ?? 0,
    bottom: parseLengthValue(styles["padding-bottom"]) ?? 0,
    left: parseLengthValue(styles["padding-left"]) ?? 0
  };
}

function parseGap(styles: StyleMap): { column: number; row: number } {
  if (styles.gap) {
    const parts = styles.gap
      .trim()
      .split(/\s+/)
      .map((token) => parseLengthValue(token) ?? 0);

    if (parts.length === 1) {
      return {
        column: parts[0],
        row: parts[0]
      };
    }

    if (parts.length >= 2) {
      return {
        row: parts[0],
        column: parts[1]
      };
    }
  }

  return {
    row: parseLengthValue(styles["row-gap"]) ?? 0,
    column: parseLengthValue(styles["column-gap"]) ?? 0
  };
}

function parseInsets(styles: StyleMap): ItemLayoutHints["inset"] {
  if (styles.inset) {
    const insetValues = styles.inset
      .trim()
      .split(/\s+/)
      .map((token) => parseInsetValue(token));

    if (insetValues.length === 1) {
      return {
        top: insetValues[0],
        right: insetValues[0],
        bottom: insetValues[0],
        left: insetValues[0]
      };
    }

    if (insetValues.length === 2) {
      return {
        top: insetValues[0],
        right: insetValues[1],
        bottom: insetValues[0],
        left: insetValues[1]
      };
    }

    if (insetValues.length === 3) {
      return {
        top: insetValues[0],
        right: insetValues[1],
        bottom: insetValues[2],
        left: insetValues[1]
      };
    }

    if (insetValues.length >= 4) {
      return {
        top: insetValues[0],
        right: insetValues[1],
        bottom: insetValues[2],
        left: insetValues[3]
      };
    }
  }

  return {
    top: parseLengthValue(styles.top),
    right: parseLengthValue(styles.right),
    bottom: parseLengthValue(styles.bottom),
    left: parseLengthValue(styles.left)
  };
}

function parseInsetValue(value: string): number | undefined {
  if (value.trim().toLowerCase() === "auto") {
    return undefined;
  }

  return parseLengthValue(value);
}

function parseClipsContent(styles: StyleMap): boolean {
  const overflow = styles.overflow?.trim().toLowerCase();

  return overflow === "hidden" || overflow === "clip";
}

function parseLengthValue(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.endsWith("px")) {
    const parsedValue = Number(trimmedValue.replace("px", "").trim());

    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmedValue)) {
    const parsedValue = Number(trimmedValue);

    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsedValue = Number(value.trim());

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function parseNumberAttribute(
  element: HTMLElement,
  attributeName: string
): number | undefined {
  return parseNumber(element.getAttribute(attributeName) ?? undefined);
}

function parseTextFills(styles: StyleMap): ColorHint[] {
  const textColor = parseColor(styles.color);

  return textColor ? [textColor] : [];
}

function parseColor(value: string | undefined): ColorHint | undefined {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim().toLowerCase();

  if (trimmedValue === "transparent" || trimmedValue === "none") {
    return undefined;
  }

  if (trimmedValue.startsWith("#")) {
    return parseHexColor(trimmedValue);
  }

  if (trimmedValue.startsWith("rgb(") || trimmedValue.startsWith("rgba(")) {
    return parseRgbColor(trimmedValue);
  }

  if (trimmedValue.startsWith("hsl(") || trimmedValue.startsWith("hsla(")) {
    return parseHslColor(trimmedValue);
  }

  if (CSS_NAMED_COLORS[trimmedValue]) {
    return parseHexColor(CSS_NAMED_COLORS[trimmedValue]);
  }

  return undefined;
}

function deriveBackgroundFills(styles: StyleMap): ColorHint[] {
  const backgroundFill =
    parseColor(styles["background-color"]) ??
    parseColorFromCompositeValue(styles.background);

  return backgroundFill ? [backgroundFill] : [];
}

function parseBorder(styles: StyleMap): StrokeHint[] {
  const borderStyle = resolveBorderStyle(styles);

  if (!borderStyle || borderStyle === "none" || borderStyle === "hidden") {
    return [];
  }

  const borderWidth = resolveBorderWidth(styles);

  if (!borderWidth || borderWidth <= 0) {
    return [];
  }

  const borderColor =
    parseColor(styles["border-color"]) ??
    parseColorFromCompositeValue(styles.border) ??
    parseColor(styles.color) ??
    parseHexColor("#000000");

  if (!borderColor) {
    return [];
  }

  return [
    {
      color: borderColor,
      weight: borderWidth
    }
  ];
}

function parseBoxShadow(value: string | undefined): ShadowHint[] {
  if (!value) {
    return [];
  }

  const trimmedValue = value.trim();

  if (!trimmedValue || trimmedValue.toLowerCase() === "none") {
    return [];
  }

  const shadows: ShadowHint[] = [];

  for (const rawShadow of splitCssValueList(trimmedValue, ",")) {
    const parsedShadow = parseSingleShadow(rawShadow);

    if (parsedShadow) {
      shadows.push(parsedShadow);
    }
  }

  return shadows;
}

function parseSingleShadow(value: string): ShadowHint | undefined {
  const tokens = splitCssValueList(value, " ");
  const lengths: number[] = [];
  let color: ColorHint | undefined;
  let type: ShadowHint["type"] = "DROP_SHADOW";

  for (const token of tokens) {
    const normalizedToken = token.trim().toLowerCase();

    if (!normalizedToken) {
      continue;
    }

    if (normalizedToken === "inset") {
      type = "INNER_SHADOW";
      continue;
    }

    const parsedColor = parseColor(token);

    if (parsedColor) {
      color = parsedColor;
      continue;
    }

    const parsedLength = parseLengthValue(token);

    if (parsedLength !== undefined) {
      lengths.push(parsedLength);
    }
  }

  if (lengths.length < 2) {
    return undefined;
  }

  return {
    blur: lengths[2] ?? 0,
    color:
      color ??
      parseRgbColor("rgba(15, 23, 42, 0.18)") ??
      (parseHexColor("#000000") as ColorHint),
    offsetX: lengths[0],
    offsetY: lengths[1],
    type
  };
}

function parseBackgroundImage(styles: StyleMap): ImageHint | undefined {
  const imageValue = styles["background-image"] ?? styles.background;

  if (!imageValue) {
    return undefined;
  }

  return createImageHint(imageValue, styles["background-size"]);
}

function createImageHint(
  rawValue: string | undefined,
  fitValue: string | undefined,
  alt?: string
): ImageHint | undefined {
  const source = parseImageSource(rawValue);

  if (!source) {
    return undefined;
  }

  return {
    alt,
    fit: resolveImageFit(fitValue),
    source,
    sourceType: source.startsWith("data:") ? "DATA" : "URL"
  };
}

function parseImageSource(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const directValue = value.trim();

  if (directValue.startsWith("data:") || directValue.startsWith("http")) {
    return directValue;
  }

  const urlMatch = directValue.match(/url\((['"]?)(.*?)\1\)/i);

  if (!urlMatch) {
    return undefined;
  }

  return urlMatch[2].trim();
}

function resolveImageFit(value: string | undefined): ImageHint["fit"] {
  switch (value?.trim().toLowerCase()) {
    case "contain":
      return "FIT";
    default:
      return "FILL";
  }
}

function parseHexColor(value: string): ColorHint | undefined {
  const normalizedValue = value.replace("#", "");

  if (normalizedValue.length === 3) {
    const [red, green, blue] = normalizedValue.split("");

    return {
      r: Number.parseInt(`${red}${red}`, 16) / 255,
      g: Number.parseInt(`${green}${green}`, 16) / 255,
      b: Number.parseInt(`${blue}${blue}`, 16) / 255,
      opacity: 1
    };
  }

  if (normalizedValue.length === 4) {
    const [red, green, blue, alpha] = normalizedValue.split("");

    return {
      r: Number.parseInt(`${red}${red}`, 16) / 255,
      g: Number.parseInt(`${green}${green}`, 16) / 255,
      b: Number.parseInt(`${blue}${blue}`, 16) / 255,
      opacity: Number.parseInt(`${alpha}${alpha}`, 16) / 255
    };
  }

  if (normalizedValue.length === 6) {
    return {
      r: Number.parseInt(normalizedValue.slice(0, 2), 16) / 255,
      g: Number.parseInt(normalizedValue.slice(2, 4), 16) / 255,
      b: Number.parseInt(normalizedValue.slice(4, 6), 16) / 255,
      opacity: 1
    };
  }

  if (normalizedValue.length === 8) {
    return {
      r: Number.parseInt(normalizedValue.slice(0, 2), 16) / 255,
      g: Number.parseInt(normalizedValue.slice(2, 4), 16) / 255,
      b: Number.parseInt(normalizedValue.slice(4, 6), 16) / 255,
      opacity: Number.parseInt(normalizedValue.slice(6, 8), 16) / 255
    };
  }

  return undefined;
}

function parseRgbColor(value: string): ColorHint | undefined {
  const content = value
    .replace("rgba(", "")
    .replace("rgb(", "")
    .replace(")", "");
  const parts = content.split(",").map((part) => part.trim());

  if (parts.length < 3) {
    return undefined;
  }

  const red = Number(parts[0]);
  const green = Number(parts[1]);
  const blue = Number(parts[2]);
  const opacity = parts[3] ? Number(parts[3]) : 1;

  if (
    !Number.isFinite(red) ||
    !Number.isFinite(green) ||
    !Number.isFinite(blue) ||
    !Number.isFinite(opacity)
  ) {
    return undefined;
  }

  return {
    r: red / 255,
    g: green / 255,
    b: blue / 255,
    opacity
  };
}

function parseHslColor(value: string): ColorHint | undefined {
  const content = value
    .replace("hsla(", "")
    .replace("hsl(", "")
    .replace(")", "");
  const parts = content.split(",").map((part) => part.trim());

  if (parts.length < 3) {
    return undefined;
  }

  const hue = Number(parts[0]);
  const saturation = parsePercentage(parts[1]);
  const lightness = parsePercentage(parts[2]);
  const opacity = parts[3] ? Number(parts[3]) : 1;

  if (
    !Number.isFinite(hue) ||
    saturation === undefined ||
    lightness === undefined ||
    !Number.isFinite(opacity)
  ) {
    return undefined;
  }

  const normalizedHue = ((hue % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = normalizedHue / 60;
  const secondComponent = chroma * (1 - Math.abs((segment % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = secondComponent;
  } else if (segment >= 1 && segment < 2) {
    red = secondComponent;
    green = chroma;
  } else if (segment >= 2 && segment < 3) {
    green = chroma;
    blue = secondComponent;
  } else if (segment >= 3 && segment < 4) {
    green = secondComponent;
    blue = chroma;
  } else if (segment >= 4 && segment < 5) {
    red = secondComponent;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondComponent;
  }

  const match = lightness - chroma / 2;

  return {
    r: red + match,
    g: green + match,
    b: blue + match,
    opacity
  };
}

function parsePercentage(value: string): number | undefined {
  const trimmedValue = value.trim();

  if (!trimmedValue.endsWith("%")) {
    return undefined;
  }

  const parsedValue = Number(trimmedValue.replace("%", "").trim());

  if (!Number.isFinite(parsedValue)) {
    return undefined;
  }

  return parsedValue / 100;
}

function parseColorFromCompositeValue(value: string | undefined): ColorHint | undefined {
  if (!value) {
    return undefined;
  }

  for (const token of splitCssValueList(value, " ")) {
    const parsedColor = parseColor(token);

    if (parsedColor) {
      return parsedColor;
    }
  }

  return extractColorFromGradient(value);
}

function extractColorFromGradient(value: string): ColorHint | undefined {
  if (!value.toLowerCase().includes("gradient(")) {
    return undefined;
  }

  const tokenMatches = value.match(
    /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b[a-z]+\b/gi
  );

  if (!tokenMatches) {
    return undefined;
  }

  for (const token of tokenMatches) {
    const parsedColor = parseColor(token);

    if (parsedColor) {
      return parsedColor;
    }
  }

  return undefined;
}

function resolveBorderStyle(styles: StyleMap): string | undefined {
  return (
    styles["border-style"]?.trim().toLowerCase() ??
    extractBorderStyleToken(styles.border)
  );
}

function resolveBorderWidth(styles: StyleMap): number | undefined {
  return (
    parseLengthValue(styles["border-width"]) ??
    extractBorderWidthToken(styles.border)
  );
}

function extractBorderStyleToken(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const supportedStyles = new Set([
    "solid",
    "dashed",
    "dotted",
    "double",
    "groove",
    "ridge",
    "inset",
    "outset",
    "none",
    "hidden"
  ]);

  for (const token of splitCssValueList(value, " ")) {
    const normalizedToken = token.trim().toLowerCase();

    if (supportedStyles.has(normalizedToken)) {
      return normalizedToken;
    }
  }

  return undefined;
}

function extractBorderWidthToken(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  for (const token of splitCssValueList(value, " ")) {
    const parsedWidth = parseLengthValue(token);

    if (parsedWidth !== undefined) {
      return parsedWidth;
    }
  }

  return undefined;
}

function splitCssValueList(value: string, separator: "," | " "): string[] {
  const result: string[] = [];
  let buffer = "";
  let depth = 0;

  for (const character of value) {
    if (character === "(") {
      depth += 1;
      buffer += character;
      continue;
    }

    if (character === ")") {
      depth = Math.max(depth - 1, 0);
      buffer += character;
      continue;
    }

    if (separator === "," && character === "," && depth === 0) {
      if (buffer.trim()) {
        result.push(buffer.trim());
      }

      buffer = "";
      continue;
    }

    if (separator === " " && /\s/.test(character) && depth === 0) {
      if (buffer.trim()) {
        result.push(buffer.trim());
      }

      buffer = "";
      continue;
    }

    buffer += character;
  }

  if (buffer.trim()) {
    result.push(buffer.trim());
  }

  return result;
}

function parseFlexShorthand(value: string | undefined): {
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
} {
  if (!value) {
    return {};
  }

  const tokens = splitCssValueList(value, " ");

  if (tokens.length === 0) {
    return {};
  }

  const numericTokens = tokens
    .map((token) => parseNumber(token))
    .filter((token): token is number => token !== undefined);
  const explicitBasisToken = tokens.find((token, index) => {
    if (index >= 2 && parseLengthValue(token) !== undefined) {
      return true;
    }

    return /px$/i.test(token.trim());
  });

  if (tokens.length === 1 && numericTokens.length === 1) {
    return {
      flexGrow: numericTokens[0],
      flexShrink: 1,
      flexBasis: 0
    };
  }

  return {
    flexGrow: numericTokens[0],
    flexShrink: numericTokens[1],
    flexBasis: explicitBasisToken
      ? parseLengthValue(explicitBasisToken)
      : undefined
  };
}

function emptyPadding(): PaddingHints {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
}

function parseFontStyle(value: string | undefined): FontStyleHint {
  return value?.toLowerCase() === "italic" ? "ITALIC" : "NORMAL";
}

function mapJustifyContent(
  value: string | undefined
): LayoutHints["justifyContent"] {
  switch (value?.toLowerCase()) {
    case "center":
      return "CENTER";
    case "flex-end":
    case "end":
      return "FLEX_END";
    case "space-between":
      return "SPACE_BETWEEN";
    default:
      return "FLEX_START";
  }
}

function mapAlignItems(value: string | undefined): LayoutHints["alignItems"] {
  switch (value?.toLowerCase()) {
    case "center":
      return "CENTER";
    case "flex-end":
    case "end":
      return "FLEX_END";
    case "stretch":
      return "STRETCH";
    default:
      return "FLEX_START";
  }
}

function mapAlignSelf(value: string | undefined): ItemLayoutHints["alignSelf"] {
  switch (value?.toLowerCase()) {
    case "center":
      return "CENTER";
    case "flex-end":
    case "end":
      return "FLEX_END";
    case "stretch":
      return "STRETCH";
    case "flex-start":
    case "start":
      return "FLEX_START";
    default:
      return "AUTO";
  }
}

function mapTextAlign(value: string | undefined): TextHints["textAlign"] {
  switch (value?.toLowerCase()) {
    case "center":
      return "CENTER";
    case "right":
    case "end":
      return "RIGHT";
    case "justify":
      return "JUSTIFIED";
    default:
      return "LEFT";
  }
}

const CSS_NAMED_COLORS: Record<string, string> = {
  aqua: "#00ffff",
  black: "#000000",
  blue: "#0000ff",
  brown: "#a52a2a",
  cyan: "#00ffff",
  fuchsia: "#ff00ff",
  gold: "#ffd700",
  gray: "#808080",
  green: "#008000",
  grey: "#808080",
  indigo: "#4b0082",
  lime: "#00ff00",
  magenta: "#ff00ff",
  maroon: "#800000",
  navy: "#000080",
  olive: "#808000",
  orange: "#ffa500",
  pink: "#ffc0cb",
  purple: "#800080",
  red: "#ff0000",
  silver: "#c0c0c0",
  teal: "#008080",
  transparent: "#000000",
  white: "#ffffff",
  yellow: "#ffff00"
};
