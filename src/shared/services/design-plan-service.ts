import { HTMLElement, Node, TextNode, parse } from "node-html-parser";
import type {
  AppearanceHints,
  ColorHint,
  DesignPlanDocument,
  DesignPlanNode,
  FontStyleHint,
  ImageHint,
  LayoutHints,
  PaddingHints,
  StyleMap,
  TextHints,
  TextSegmentHints
} from "../contracts.js";

const TEXT_ONLY_TAGS = new Set([
  "a",
  "b",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "i",
  "label",
  "p",
  "small",
  "span",
  "strong"
]);

interface MapContext {
  inheritedTextStyles: StyleMap;
  path: string;
}

interface InlineTextFragment {
  styles: StyleMap;
  text: string;
}

interface InlineTextCollection {
  fragments: InlineTextFragment[];
  text: string;
}

export function createDesignPlan(mergedHtml: string): DesignPlanDocument {
  const documentNode = parse(mergedHtml, {
    blockTextElements: {
      script: false,
      noscript: false,
      style: false,
      pre: true
    }
  });
  const bodyElement = documentNode.querySelector("body");
  const sourceRoot = bodyElement ?? documentNode;
  const rootStyles = bodyElement
    ? parseInlineStyle(bodyElement.getAttribute("style") ?? "")
    : {};
  const rootChildren = sourceRoot.childNodes
    .map((node, index) =>
      mapDomNode(node, {
        inheritedTextStyles: pickTextStyles(rootStyles),
        path: `root-${index}`
      })
    )
    .filter((node): node is DesignPlanNode => node !== null);

  return {
    version: 1,
    metadata: {
      generatedAt: new Date().toISOString(),
      source: "inline-html"
    },
    root: {
      id: "root",
      kind: "FRAME",
      name: "HTML Root",
      tagName: bodyElement ? "body" : "root",
      textContent: undefined,
      styles: rootStyles,
      layout: deriveLayout(rootStyles, Math.max(rootChildren.length, 1), true),
      appearance: deriveAppearance(rootStyles),
      text: undefined,
      children: rootChildren
    }
  };
}

function mapDomNode(node: Node, context: MapContext): DesignPlanNode | null {
  if (node instanceof TextNode) {
    return mapTextNode(node, context);
  }

  if (!(node instanceof HTMLElement)) {
    return null;
  }

  return mapElementNode(node, context);
}

function mapTextNode(node: TextNode, context: MapContext): DesignPlanNode | null {
  const collection = buildInlineTextCollection([
    {
      styles: context.inheritedTextStyles,
      text: normalizeInlineText(node.rawText)
    }
  ]);

  if (!collection) {
    return null;
  }

  return createTextPlanNode({
    id: context.path,
    name: "Text",
    tagName: "text",
    textContent: collection.text,
    styles: context.inheritedTextStyles,
    segments: createTextSegments(collection.fragments)
  });
}

function mapElementNode(
  element: HTMLElement,
  context: MapContext
): DesignPlanNode | null {
  const tagName = element.tagName.toLowerCase();
  const styles = parseInlineStyle(element.getAttribute("style") ?? "");
  const mergedTextStyles = mergeTextStyles(
    context.inheritedTextStyles,
    tagName,
    styles
  );

  if (tagName === "img") {
    return createImagePlanNode(element, context.path, styles);
  }

  const inlineTextCollection = TEXT_ONLY_TAGS.has(tagName)
    ? collectInlineTextContent(element, mergedTextStyles)
    : null;

  if (inlineTextCollection) {
    return createTextPlanNode({
      id: context.path,
      name: createNodeName(tagName),
      tagName,
      textContent: inlineTextCollection.text,
      styles: mergedTextStyles,
      segments: createTextSegments(inlineTextCollection.fragments)
    });
  }

  const mappedChildren = element.childNodes
    .map((child, index) =>
      mapDomNode(child, {
        inheritedTextStyles: mergedTextStyles,
        path: `${context.path}-${index}`
      })
    )
    .filter((node): node is DesignPlanNode => node !== null);
  const elementChildCount = mappedChildren.length;

  return {
    id: context.path,
    kind: "FRAME",
    name: createNodeName(tagName),
    tagName,
    textContent: undefined,
    styles,
    layout: deriveLayout(styles, elementChildCount, false),
    appearance: deriveAppearance(styles),
    text: undefined,
    children: mappedChildren
  };
}

function createTextPlanNode({
  id,
  name,
  tagName,
  textContent,
  styles,
  segments
}: {
  id: string;
  name: string;
  tagName: string;
  textContent: string;
  styles: StyleMap;
  segments: TextSegmentHints[];
}): DesignPlanNode {
  return {
    id,
    kind: "TEXT",
    name,
    tagName,
    textContent,
    styles,
    layout: {
      mode: "NONE",
      gap: 0,
      padding: emptyPadding(),
      width: parsePixelValue(styles.width),
      height: parsePixelValue(styles.height),
      justifyContent: "FLEX_START",
      alignItems: "FLEX_START"
    },
    appearance: {
      fills: parseTextFills(styles),
      opacity: parseNumber(styles.opacity)
    },
    text: deriveTextHints(styles, segments),
    children: []
  };
}

function createImagePlanNode(
  element: HTMLElement,
  id: string,
  styles: StyleMap
): DesignPlanNode {
  const width =
    parsePixelValue(styles.width) ?? parseNumberAttribute(element, "width") ?? 160;
  const height =
    parsePixelValue(styles.height) ??
    parseNumberAttribute(element, "height") ??
    120;
  const image = createImageHint(
    element.getAttribute("src"),
    styles["object-fit"],
    element.getAttribute("alt") ?? undefined
  );

  return {
    id,
    kind: "IMAGE",
    name: "Image",
    tagName: "img",
    textContent: undefined,
    styles,
    layout: {
      mode: "NONE",
      gap: 0,
      padding: emptyPadding(),
      width,
      height,
      justifyContent: "FLEX_START",
      alignItems: "FLEX_START"
    },
    appearance: {
      ...deriveAppearance(styles),
      image
    },
    text: undefined,
    children: []
  };
}

function collectInlineTextContent(
  element: HTMLElement,
  inheritedTextStyles: StyleMap
): InlineTextCollection | null {
  const fragments = collectInlineFragmentsFromNodes(
    element.childNodes,
    inheritedTextStyles
  );

  return buildInlineTextCollection(fragments);
}

function collectInlineFragmentsFromNodes(
  nodes: Node[],
  inheritedTextStyles: StyleMap
): InlineTextFragment[] | null {
  const fragments: InlineTextFragment[] = [];

  for (const node of nodes) {
    if (node instanceof TextNode) {
      const normalizedText = normalizeInlineText(node.rawText);

      if (normalizedText) {
        fragments.push({
          styles: inheritedTextStyles,
          text: normalizedText
        });
      }

      continue;
    }

    if (!(node instanceof HTMLElement)) {
      continue;
    }

    const tagName = node.tagName.toLowerCase();

    if (tagName === "br") {
      fragments.push({
        styles: inheritedTextStyles,
        text: "\n"
      });
      continue;
    }

    if (!TEXT_ONLY_TAGS.has(tagName)) {
      return null;
    }

    const childStyles = mergeTextStyles(
      inheritedTextStyles,
      tagName,
      parseInlineStyle(node.getAttribute("style") ?? "")
    );
    const childFragments = collectInlineFragmentsFromNodes(
      node.childNodes,
      childStyles
    );

    if (childFragments === null) {
      return null;
    }

    fragments.push(...childFragments);
  }

  return fragments;
}

function buildInlineTextCollection(
  fragments: InlineTextFragment[] | null
): InlineTextCollection | null {
  if (!fragments || fragments.length === 0) {
    return null;
  }

  let text = "";
  const normalizedFragments: InlineTextFragment[] = [];

  for (const fragment of fragments) {
    const preparedText = prepareInlineText(text, fragment.text);

    if (!preparedText) {
      continue;
    }

    normalizedFragments.push({
      styles: fragment.styles,
      text: preparedText
    });
    text += preparedText;
  }

  const trimmedText = text.trimEnd();

  if (!trimmedText) {
    return null;
  }

  const trailingCharactersToTrim = text.length - trimmedText.length;

  if (trailingCharactersToTrim > 0 && normalizedFragments.length > 0) {
    const lastFragment = normalizedFragments[normalizedFragments.length - 1];

    lastFragment.text = lastFragment.text.slice(
      0,
      Math.max(lastFragment.text.length - trailingCharactersToTrim, 0)
    );

    if (!lastFragment.text) {
      normalizedFragments.pop();
    }
  }

  return {
    fragments: normalizedFragments,
    text: trimmedText
  };
}

function createTextSegments(
  fragments: InlineTextFragment[]
): TextSegmentHints[] {
  const segments: TextSegmentHints[] = [];
  let cursor = 0;

  for (const fragment of fragments) {
    if (!fragment.text) {
      continue;
    }

    const nextSegment = createTextSegment(fragment, cursor);
    const previousSegment = segments[segments.length - 1];

    if (previousSegment && areTextSegmentsEquivalent(previousSegment, nextSegment)) {
      previousSegment.end = nextSegment.end;
    } else {
      segments.push(nextSegment);
    }

    cursor = nextSegment.end;
  }

  return segments;
}

function createTextSegment(
  fragment: InlineTextFragment,
  start: number
): TextSegmentHints {
  return {
    start,
    end: start + fragment.text.length,
    fills: parseTextFills(fragment.styles),
    fontSize: parsePixelValue(fragment.styles["font-size"]),
    fontStyle: parseFontStyle(fragment.styles["font-style"]),
    fontWeight: parseNumber(fragment.styles["font-weight"]),
    lineHeight: parsePixelValue(fragment.styles["line-height"]),
    letterSpacing: parsePixelValue(fragment.styles["letter-spacing"])
  };
}

function areTextSegmentsEquivalent(
  left: TextSegmentHints,
  right: TextSegmentHints
): boolean {
  return (
    left.fontSize === right.fontSize &&
    left.fontStyle === right.fontStyle &&
    left.fontWeight === right.fontWeight &&
    left.lineHeight === right.lineHeight &&
    left.letterSpacing === right.letterSpacing &&
    areColorListsEquivalent(left.fills, right.fills)
  );
}

function deriveLayout(
  styles: StyleMap,
  childCount: number,
  isRoot: boolean
): LayoutHints {
  const display = styles.display?.toLowerCase();
  const flexDirection = styles["flex-direction"]?.toLowerCase() ?? "row";
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
    gap: parsePixelValue(styles.gap) ?? 0,
    padding: parsePadding(styles.padding, styles),
    width: parsePixelValue(styles.width),
    height: parsePixelValue(styles.height),
    justifyContent: mapJustifyContent(styles["justify-content"]),
    alignItems: mapAlignItems(styles["align-items"])
  };
}

function deriveAppearance(styles: StyleMap): AppearanceHints {
  const backgroundFill =
    parseColor(styles["background-color"]) ?? parseColor(styles.background);

  return {
    fills: backgroundFill ? [backgroundFill] : [],
    image: parseBackgroundImage(styles),
    cornerRadius: parsePixelValue(styles["border-radius"]),
    opacity: parseNumber(styles.opacity)
  };
}

function deriveTextHints(
  styles: StyleMap,
  segments: TextSegmentHints[]
): TextHints {
  return {
    fontSize: parsePixelValue(styles["font-size"]),
    fontStyle: parseFontStyle(styles["font-style"]),
    fontWeight: parseNumber(styles["font-weight"]),
    lineHeight: parsePixelValue(styles["line-height"]),
    letterSpacing: parsePixelValue(styles["letter-spacing"]),
    segments,
    textAlign: mapTextAlign(styles["text-align"])
  };
}

function parseInlineStyle(styleText: string): StyleMap {
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

function pickTextStyles(styles: StyleMap): StyleMap {
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
    "height",
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

function mergeTextStyles(
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
      .map((value) => parsePixelValue(value) ?? 0);

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
    top: parsePixelValue(styles["padding-top"]) ?? 0,
    right: parsePixelValue(styles["padding-right"]) ?? 0,
    bottom: parsePixelValue(styles["padding-bottom"]) ?? 0,
    left: parsePixelValue(styles["padding-left"]) ?? 0
  };
}

function parsePixelValue(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  if (value.endsWith("px")) {
    const parsedValue = Number(value.replace("px", "").trim());

    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  if (/^-?\d+(\.\d+)?$/.test(value.trim())) {
    const parsedValue = Number(value.trim());

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

  return undefined;
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

  if (normalizedValue.length === 6) {
    return {
      r: Number.parseInt(normalizedValue.slice(0, 2), 16) / 255,
      g: Number.parseInt(normalizedValue.slice(2, 4), 16) / 255,
      b: Number.parseInt(normalizedValue.slice(4, 6), 16) / 255,
      opacity: 1
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

function normalizeInlineText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ");
}

function prepareInlineText(currentText: string, nextText: string): string {
  if (!nextText) {
    return "";
  }

  let preparedText = nextText;

  if (!currentText) {
    preparedText = preparedText.replace(/^ +/g, "");
  }

  if (currentText.endsWith(" ") && preparedText.startsWith(" ")) {
    preparedText = preparedText.replace(/^ +/g, " ");
  }

  return preparedText;
}

function createNodeName(tagName: string): string {
  return tagName.charAt(0).toUpperCase() + tagName.slice(1);
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
  return value?.trim().toLowerCase() === "italic" ? "ITALIC" : "NORMAL";
}

function mapJustifyContent(
  value: string | undefined
): LayoutHints["justifyContent"] {
  switch (value?.toLowerCase()) {
    case "center":
      return "CENTER";
    case "flex-end":
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
      return "FLEX_END";
    case "stretch":
      return "STRETCH";
    default:
      return "FLEX_START";
  }
}

function mapTextAlign(value: string | undefined): TextHints["textAlign"] {
  switch (value?.toLowerCase()) {
    case "center":
      return "CENTER";
    case "right":
      return "RIGHT";
    case "justify":
      return "JUSTIFIED";
    default:
      return "LEFT";
  }
}

function areColorListsEquivalent(
  left: ColorHint[],
  right: ColorHint[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftColor, index) => {
    const rightColor = right[index];

    return (
      leftColor.r === rightColor.r &&
      leftColor.g === rightColor.g &&
      leftColor.b === rightColor.b &&
      leftColor.opacity === rightColor.opacity
    );
  });
}
