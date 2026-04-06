import type {
  AppearanceHints,
  ColorHint,
  DesignPlanDocument,
  DesignPlanNode,
  FigmaTransferDocument,
  FigmaTransferNode,
  ItemLayoutHints,
  LayoutHints,
  ShadowHint,
  TextHints,
  TextSegmentHints
} from "../contracts.js";

const MAX_FIGMA_DIMENSION = 10000;
const MAX_FIGMA_RADIUS = 1000;

export function createFigmaTransferDocument(
  document: DesignPlanDocument
): FigmaTransferDocument {
  const warnings: string[] = [];

  return {
    version: 1,
    metadata: {
      generatedAt: document.metadata.generatedAt,
      handoff: "figma-safe",
      source: document.metadata.source
    },
    root: sanitizeTransferNode(document.root, "root", warnings),
    warnings
  };
}

function sanitizeTransferNode(
  node: DesignPlanNode,
  path: string,
  warnings: string[]
): FigmaTransferNode {
  const textContent = node.textContent ?? "";
  const children =
    node.kind === "FRAME"
      ? node.children.map((child, index) =>
          sanitizeTransferNode(child, `${path}.${index}`, warnings)
        )
      : [];

  if (node.kind !== "FRAME" && node.children.length > 0) {
    warnings.push(
      `Non-frame node children were dropped during Figma transfer sanitization: ${path}.`
    );
  }

  return {
    id: node.id,
    kind: node.kind,
    name: sanitizeNodeName(node.name, node.kind),
    tagName: node.tagName,
    textContent: textContent || undefined,
    layout: sanitizeLayout(node.layout, path, warnings),
    item: sanitizeItemLayout(node.item),
    appearance: sanitizeAppearance(node.appearance, path, warnings),
    text: node.kind === "TEXT"
      ? sanitizeTextHints(node.text, textContent, path, warnings)
      : undefined,
    children
  };
}

function sanitizeNodeName(
  value: string | undefined,
  kind: FigmaTransferNode["kind"]
): string {
  const trimmedValue = value?.trim();

  if (trimmedValue) {
    return trimmedValue;
  }

  switch (kind) {
    case "TEXT":
      return "Text";
    case "IMAGE":
      return "Image";
    default:
      return "Frame";
  }
}

function sanitizeLayout(
  layout: LayoutHints,
  path: string,
  warnings: string[]
): LayoutHints {
  const mode = sanitizeLayoutMode(layout.mode);
  const width = sanitizePositiveNumber(layout.width);
  const height = sanitizePositiveNumber(layout.height);
  const minWidth = sanitizePositiveNumber(layout.minWidth);
  const maxWidth = sanitizePositiveNumber(layout.maxWidth);
  const minHeight = sanitizePositiveNumber(layout.minHeight);
  const maxHeight = sanitizePositiveNumber(layout.maxHeight);
  const normalizedWidthRange = normalizeLengthRange(
    minWidth,
    maxWidth,
    `${path}.layout.width`,
    warnings
  );
  const normalizedHeightRange = normalizeLengthRange(
    minHeight,
    maxHeight,
    `${path}.layout.height`,
    warnings
  );

  return {
    mode,
    gap: mode === "NONE" ? 0 : sanitizeNonNegativeNumber(layout.gap),
    crossGap: mode === "NONE" ? 0 : sanitizeNonNegativeNumber(layout.crossGap),
    wrap: mode === "NONE" ? "NO_WRAP" : sanitizeWrap(layout.wrap),
    padding: {
      top: sanitizeNonNegativeNumber(layout.padding.top),
      right: sanitizeNonNegativeNumber(layout.padding.right),
      bottom: sanitizeNonNegativeNumber(layout.padding.bottom),
      left: sanitizeNonNegativeNumber(layout.padding.left)
    },
    width,
    height,
    minWidth: normalizedWidthRange.min,
    maxWidth: normalizedWidthRange.max,
    minHeight: normalizedHeightRange.min,
    maxHeight: normalizedHeightRange.max,
    clipsContent: Boolean(layout.clipsContent),
    justifyContent: sanitizeJustifyContent(layout.justifyContent),
    alignItems: sanitizeAlignItems(layout.alignItems)
  };
}

function sanitizeItemLayout(item: ItemLayoutHints): ItemLayoutHints {
  return {
    margin: {
      top: sanitizeNonNegativeNumber(item.margin.top),
      right: sanitizeNonNegativeNumber(item.margin.right),
      bottom: sanitizeNonNegativeNumber(item.margin.bottom),
      left: sanitizeNonNegativeNumber(item.margin.left)
    },
    alignSelf: sanitizeAlignSelf(item.alignSelf),
    flexGrow: sanitizeNonNegativeNumber(item.flexGrow),
    flexShrink: sanitizeNonNegativeNumber(item.flexShrink, 1),
    flexBasis: sanitizePositiveNumber(item.flexBasis),
    position: item.position === "ABSOLUTE" ? "ABSOLUTE" : "AUTO",
    inset: {
      top: sanitizeSignedNumber(item.inset.top),
      right: sanitizeSignedNumber(item.inset.right),
      bottom: sanitizeSignedNumber(item.inset.bottom),
      left: sanitizeSignedNumber(item.inset.left)
    },
    zIndex: sanitizeInteger(item.zIndex)
  };
}

function sanitizeAppearance(
  appearance: AppearanceHints,
  path: string,
  warnings: string[]
): AppearanceHints {
  const image = sanitizeImageHint(appearance.image, `${path}.appearance`, warnings);

  return {
    fills: appearance.fills.map(sanitizeColorHint),
    image,
    shadows: appearance.shadows.map(sanitizeShadowHint),
    strokes: appearance.strokes
      .map((stroke) => ({
        color: sanitizeColorHint(stroke.color),
        weight: sanitizeNonNegativeNumber(stroke.weight)
      }))
      .filter((stroke) => stroke.weight > 0),
    cornerRadius: sanitizeNonNegativeNumber(
      appearance.cornerRadius,
      undefined,
      MAX_FIGMA_RADIUS
    ),
    opacity: sanitizeOpacity(appearance.opacity)
  };
}

function sanitizeImageHint(
  image: AppearanceHints["image"],
  path: string,
  warnings: string[]
) {
  if (!image) {
    return undefined;
  }

  const source = image.source.trim();

  if (!source) {
    warnings.push(`Empty image source was dropped during Figma transfer: ${path}.`);
    return undefined;
  }

  if (image.sourceType === "DATA" && source.startsWith("data:")) {
    return {
      ...image,
      source
    };
  }

  if (image.sourceType === "URL" && /^https?:\/\//i.test(source)) {
    return {
      ...image,
      source
    };
  }

  warnings.push(
    `Unsupported image source was dropped during Figma transfer: ${path}.`
  );

  return undefined;
}

function sanitizeTextHints(
  text: TextHints | undefined,
  textContent: string,
  path: string,
  warnings: string[]
): TextHints {
  let hasNormalizedSegment = false;
  const sanitizedSegments = (text?.segments ?? [])
    .map((segment) => {
      const normalizedSegment = sanitizeTextSegment(segment, textContent.length);

      if (!normalizedSegment) {
        hasNormalizedSegment = true;
        return null;
      }

      if (!areTextSegmentsEquivalent(segment, normalizedSegment)) {
        hasNormalizedSegment = true;
      }

      return normalizedSegment;
    })
    .filter((segment): segment is TextSegmentHints => segment !== null)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  if (hasNormalizedSegment) {
    warnings.push(
      `Invalid text segments were normalized during Figma transfer: ${path}.`
    );
  }

  return {
    fontSize: sanitizePositiveNumber(text?.fontSize),
    fontStyle: text?.fontStyle === "ITALIC" ? "ITALIC" : "NORMAL",
    fontWeight: sanitizePositiveNumber(text?.fontWeight),
    lineHeight: sanitizePositiveNumber(text?.lineHeight),
    letterSpacing: sanitizeSignedNumber(text?.letterSpacing),
    segments: sanitizedSegments,
    textAlign: sanitizeTextAlign(text?.textAlign)
  };
}

function sanitizeTextSegment(
  segment: TextSegmentHints,
  textLength: number
): TextSegmentHints | null {
  const start = clampInteger(segment.start, 0, textLength);
  const end = clampInteger(segment.end, start, textLength);

  if (start >= end) {
    return null;
  }

  return {
    start,
    end,
    fills: segment.fills.map(sanitizeColorHint),
    fontSize: sanitizePositiveNumber(segment.fontSize),
    fontStyle: segment.fontStyle === "ITALIC" ? "ITALIC" : "NORMAL",
    fontWeight: sanitizePositiveNumber(segment.fontWeight),
    letterSpacing: sanitizeSignedNumber(segment.letterSpacing),
    lineHeight: sanitizePositiveNumber(segment.lineHeight)
  };
}

function sanitizeColorHint(color: ColorHint): ColorHint {
  return {
    r: clampNumber(color.r, 0, 1),
    g: clampNumber(color.g, 0, 1),
    b: clampNumber(color.b, 0, 1),
    opacity: clampNumber(color.opacity, 0, 1)
  };
}

function sanitizeShadowHint(shadow: ShadowHint): ShadowHint {
  return {
    blur: sanitizeNonNegativeNumber(shadow.blur),
    color: sanitizeColorHint(shadow.color),
    offsetX: sanitizeSignedNumber(shadow.offsetX) ?? 0,
    offsetY: sanitizeSignedNumber(shadow.offsetY) ?? 0,
    type: shadow.type === "INNER_SHADOW" ? "INNER_SHADOW" : "DROP_SHADOW"
  };
}

function areTextSegmentsEquivalent(
  left: TextSegmentHints,
  right: TextSegmentHints
): boolean {
  return (
    left.start === right.start &&
    left.end === right.end &&
    left.fontSize === right.fontSize &&
    left.fontStyle === right.fontStyle &&
    left.fontWeight === right.fontWeight &&
    left.lineHeight === right.lineHeight &&
    left.letterSpacing === right.letterSpacing &&
    JSON.stringify(left.fills) === JSON.stringify(right.fills)
  );
}

function sanitizeLayoutMode(value: LayoutHints["mode"]): LayoutHints["mode"] {
  switch (value) {
    case "HORIZONTAL":
    case "VERTICAL":
      return value;
    default:
      return "NONE";
  }
}

function sanitizeWrap(value: LayoutHints["wrap"]): LayoutHints["wrap"] {
  return value === "WRAP" ? "WRAP" : "NO_WRAP";
}

function sanitizeJustifyContent(
  value: LayoutHints["justifyContent"]
): LayoutHints["justifyContent"] {
  switch (value) {
    case "CENTER":
    case "FLEX_END":
    case "SPACE_BETWEEN":
      return value;
    default:
      return "FLEX_START";
  }
}

function sanitizeAlignItems(
  value: LayoutHints["alignItems"]
): LayoutHints["alignItems"] {
  switch (value) {
    case "CENTER":
    case "FLEX_END":
    case "STRETCH":
      return value;
    default:
      return "FLEX_START";
  }
}

function sanitizeAlignSelf(
  value: ItemLayoutHints["alignSelf"]
): ItemLayoutHints["alignSelf"] {
  switch (value) {
    case "FLEX_START":
    case "CENTER":
    case "FLEX_END":
    case "STRETCH":
      return value;
    default:
      return "AUTO";
  }
}

function sanitizeTextAlign(
  value: TextHints["textAlign"] | undefined
): TextHints["textAlign"] {
  switch (value) {
    case "CENTER":
    case "RIGHT":
    case "JUSTIFIED":
      return value;
    default:
      return "LEFT";
  }
}

function normalizeLengthRange(
  min: number | undefined,
  max: number | undefined,
  path: string,
  warnings: string[]
) {
  if (min !== undefined && max !== undefined && min > max) {
    warnings.push(`Invalid min/max range was normalized during Figma transfer: ${path}.`);

    return {
      min,
      max: min
    };
  }

  return { min, max };
}

function sanitizeOpacity(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return clampNumber(value, 0, 1);
}

function sanitizePositiveNumber(
  value: number | undefined,
  fallback?: number,
  maximum = MAX_FIGMA_DIMENSION
): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return clampNumber(Math.round(value * 1000) / 1000, 0, maximum);
}

function sanitizeNonNegativeNumber(
  value: number | undefined,
  fallback = 0,
  maximum = MAX_FIGMA_DIMENSION
): number {
  return sanitizePositiveNumber(value, fallback, maximum) ?? fallback;
}

function sanitizeSignedNumber(
  value: number | undefined,
  maximum = MAX_FIGMA_DIMENSION
): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return clampNumber(Math.round(value * 1000) / 1000, -maximum, maximum);
}

function sanitizeInteger(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.round(value);
}

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(Math.round(value), minimum), maximum);
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
