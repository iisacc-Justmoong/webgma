import { HTMLElement, Node, TextNode, parse } from "node-html-parser";
import type {
  AppearanceHints,
  ColorHint,
  DesignPlanDocument,
  DesignPlanNode,
  LayoutHints,
  PaddingHints,
  StyleMap,
  TextHints
} from "../contracts.js";

const TEXT_ONLY_TAGS = new Set([
  "span",
  "p",
  "strong",
  "em",
  "small",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6"
]);

interface MapContext {
  inheritedTextStyles: StyleMap;
  path: string;
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
  const textContent = normalizeWhitespace(node.rawText);

  if (!textContent) {
    return null;
  }

  return createTextPlanNode({
    id: context.path,
    name: "Text",
    tagName: "text",
    textContent,
    styles: context.inheritedTextStyles
  });
}

function mapElementNode(
  element: HTMLElement,
  context: MapContext
): DesignPlanNode | null {
  const tagName = element.tagName.toLowerCase();
  const styles = parseInlineStyle(element.getAttribute("style") ?? "");
  const inheritedTextStyles = {
    ...context.inheritedTextStyles,
    ...pickTextStyles(styles)
  };
  const mappedChildren = element.childNodes
    .map((child, index) =>
      mapDomNode(child, {
        inheritedTextStyles,
        path: `${context.path}-${index}`
      })
    )
    .filter((node): node is DesignPlanNode => node !== null);
  const elementChildCount = element.childNodes.filter(
    (childNode) => childNode instanceof HTMLElement
  ).length;

  if (TEXT_ONLY_TAGS.has(tagName) && elementChildCount === 0) {
    const textContent = normalizeWhitespace(element.textContent);

    if (!textContent) {
      return null;
    }

    return createTextPlanNode({
      id: context.path,
      name: createNodeName(tagName),
      tagName,
      textContent,
      styles: inheritedTextStyles
    });
  }

  return {
    id: context.path,
    kind: "FRAME",
    name: createNodeName(tagName),
    tagName,
    textContent: undefined,
    styles,
    layout: deriveLayout(styles, Math.max(mappedChildren.length, 1), false),
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
  styles
}: {
  id: string;
  name: string;
  tagName: string;
  textContent: string;
  styles: StyleMap;
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
    text: deriveTextHints(styles),
    children: []
  };
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
      : childCount > 1 || isRoot
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
    cornerRadius: parsePixelValue(styles["border-radius"]),
    opacity: parseNumber(styles.opacity)
  };
}

function deriveTextHints(styles: StyleMap): TextHints {
  return {
    fontSize: parsePixelValue(styles["font-size"]),
    fontWeight: parseNumber(styles["font-weight"]),
    lineHeight: parsePixelValue(styles["line-height"]),
    letterSpacing: parsePixelValue(styles["letter-spacing"]),
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

function normalizeWhitespace(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
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
