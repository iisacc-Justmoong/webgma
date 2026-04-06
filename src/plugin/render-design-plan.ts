import type {
  ColorHint,
  DesignPlanDocument,
  DesignPlanNode,
  FontStyleHint,
  ImageHint,
  LayoutHints,
  TextSegmentHints
} from "../shared/contracts.js";

const DEFAULT_TEXT_COLOR: readonly SolidPaint[] = [
  {
    type: "SOLID",
    color: {
      r: 0.1,
      g: 0.1,
      b: 0.1
    },
    opacity: 1
  }
];

const IMAGE_PLACEHOLDER_FILL: readonly SolidPaint[] = [
  {
    type: "SOLID",
    color: {
      r: 0.9,
      g: 0.92,
      b: 0.96
    },
    opacity: 1
  }
];

export async function renderDesignPlan(
  document: DesignPlanDocument
): Promise<FrameNode> {
  const rootNode = (await createSceneNode(document.root)) as FrameNode;
  rootNode.x = figma.viewport.center.x - rootNode.width / 2;
  rootNode.y = figma.viewport.center.y - rootNode.height / 2;
  figma.currentPage.appendChild(rootNode);

  return rootNode;
}

async function createSceneNode(node: DesignPlanNode): Promise<SceneNode> {
  if (node.kind === "TEXT") {
    return createTextNode(node);
  }

  if (node.kind === "IMAGE") {
    return createImageNode(node);
  }

  const frame = figma.createFrame();
  frame.name = node.name;
  frame.cornerRadius = node.appearance.cornerRadius ?? 0;
  frame.opacity = node.appearance.opacity ?? 1;

  applyFrameLayout(frame, node.layout);
  await applyImageAwareFills(frame, node.appearance.fills, node.appearance.image);

  for (const childNode of node.children) {
    const sceneChild = await createSceneNode(childNode);

    if ("layoutAlign" in sceneChild && node.layout.alignItems === "STRETCH") {
      sceneChild.layoutAlign = "STRETCH";
    }

    frame.appendChild(sceneChild);
  }

  return frame;
}

async function createTextNode(node: DesignPlanNode): Promise<TextNode> {
  const textNode = figma.createText();
  const baseFontName = resolveFontName(
    node.text?.fontWeight,
    node.text?.fontStyle ?? "NORMAL"
  );
  const segments = node.text?.segments ?? [];

  await loadFontsForSegments(baseFontName, segments);

  textNode.name = node.name;
  textNode.fontName = baseFontName;
  textNode.characters = node.textContent ?? "";
  textNode.fontSize = node.text?.fontSize ?? 16;
  textNode.lineHeight = node.text?.lineHeight
    ? {
        unit: "PIXELS",
        value: node.text.lineHeight
      }
    : {
        unit: "AUTO"
      };
  textNode.letterSpacing = node.text?.letterSpacing
    ? {
        unit: "PIXELS",
        value: node.text.letterSpacing
      }
    : {
        unit: "PIXELS",
        value: 0
      };
  textNode.textAlignHorizontal = node.text?.textAlign ?? "LEFT";
  textNode.fills = node.appearance.fills.length
    ? node.appearance.fills.map(toSolidPaint)
    : [...DEFAULT_TEXT_COLOR];
  textNode.opacity = node.appearance.opacity ?? 1;
  textNode.textAutoResize = node.layout.width ? "HEIGHT" : "WIDTH_AND_HEIGHT";

  if (node.layout.width) {
    textNode.resize(node.layout.width, textNode.height);
  }

  applyTextSegments(textNode, segments);

  return textNode;
}

async function createImageNode(node: DesignPlanNode): Promise<FrameNode> {
  const frame = figma.createFrame();
  const width = node.layout.width ?? 160;
  const height = node.layout.height ?? 120;
  const imagePaint = node.appearance.image
    ? await toImagePaint(node.appearance.image)
    : null;

  frame.name = node.name;
  frame.layoutMode = "NONE";
  frame.cornerRadius = node.appearance.cornerRadius ?? 0;
  frame.opacity = node.appearance.opacity ?? 1;
  frame.clipsContent = true;
  frame.resize(width, height);

  if (imagePaint) {
    frame.fills = [imagePaint];
    return frame;
  }

  frame.fills = node.appearance.fills.length
    ? node.appearance.fills.map(toSolidPaint)
    : [...IMAGE_PLACEHOLDER_FILL];
  await appendImagePlaceholder(frame, node.appearance.image?.alt);

  return frame;
}

function applyFrameLayout(frame: FrameNode, layout: LayoutHints) {
  frame.layoutMode = layout.mode;
  frame.itemSpacing = layout.gap;
  frame.paddingTop = layout.padding.top;
  frame.paddingRight = layout.padding.right;
  frame.paddingBottom = layout.padding.bottom;
  frame.paddingLeft = layout.padding.left;
  frame.primaryAxisAlignItems = mapPrimaryAlignment(layout.justifyContent);
  frame.counterAxisAlignItems = mapCounterAlignment(layout.alignItems);
  frame.primaryAxisSizingMode =
    layout.mode === "VERTICAL"
      ? layout.height
        ? "FIXED"
        : "AUTO"
      : layout.width
        ? "FIXED"
        : "AUTO";
  frame.counterAxisSizingMode =
    layout.mode === "VERTICAL"
      ? layout.width
        ? "FIXED"
        : "AUTO"
      : layout.height
        ? "FIXED"
        : "AUTO";

  if (layout.width && layout.height) {
    frame.resize(layout.width, layout.height);
    return;
  }

  if (layout.width) {
    frame.resize(layout.width, frame.height);
  }

  if (layout.height) {
    frame.resize(frame.width, layout.height);
  }
}

async function applyImageAwareFills(
  node: GeometryMixin,
  fills: ColorHint[],
  image: ImageHint | undefined
) {
  const solidPaints = fills.map(toSolidPaint);
  const imagePaint = image ? await toImagePaint(image) : null;

  if (imagePaint) {
    node.fills = [...solidPaints, imagePaint];
    return;
  }

  node.fills = solidPaints;
}

function applyTextSegments(textNode: TextNode, segments: TextSegmentHints[]) {
  for (const segment of segments) {
    if (segment.start >= segment.end) {
      continue;
    }

    const fontName = resolveFontName(segment.fontWeight, segment.fontStyle);

    textNode.setRangeFontName(segment.start, segment.end, fontName);

    if (segment.fontSize) {
      textNode.setRangeFontSize(segment.start, segment.end, segment.fontSize);
    }

    if (segment.lineHeight) {
      textNode.setRangeLineHeight(segment.start, segment.end, {
        unit: "PIXELS",
        value: segment.lineHeight
      });
    }

    if (segment.letterSpacing !== undefined) {
      textNode.setRangeLetterSpacing(segment.start, segment.end, {
        unit: "PIXELS",
        value: segment.letterSpacing
      });
    }

    if (segment.fills.length > 0) {
      textNode.setRangeFills(
        segment.start,
        segment.end,
        segment.fills.map(toSolidPaint)
      );
    }
  }
}

async function loadFontsForSegments(
  baseFontName: FontName,
  segments: TextSegmentHints[]
) {
  const fontNames = new Map<string, FontName>();

  fontNames.set(stringifyFontName(baseFontName), baseFontName);

  for (const segment of segments) {
    const fontName = resolveFontName(segment.fontWeight, segment.fontStyle);

    fontNames.set(stringifyFontName(fontName), fontName);
  }

  for (const fontName of fontNames.values()) {
    await figma.loadFontAsync(fontName);
  }
}

function resolveFontName(
  weight: number | undefined,
  fontStyle: FontStyleHint
): FontName {
  const resolvedWeight = weight ?? 400;

  if (resolvedWeight >= 700 && fontStyle === "ITALIC") {
    return { family: "Inter", style: "Bold Italic" };
  }

  if (resolvedWeight >= 700) {
    return { family: "Inter", style: "Bold" };
  }

  if (fontStyle === "ITALIC") {
    return { family: "Inter", style: "Italic" };
  }

  return { family: "Inter", style: "Regular" };
}

async function toImagePaint(image: ImageHint): Promise<ImagePaint | null> {
  try {
    const bytes = await loadImageBytes(image);
    const imageHash = figma.createImage(bytes).hash;

    return {
      type: "IMAGE",
      imageHash,
      scaleMode: image.fit
    };
  } catch {
    return null;
  }
}

async function loadImageBytes(image: ImageHint): Promise<Uint8Array> {
  if (image.sourceType === "DATA") {
    return decodeDataUrl(image.source);
  }

  const response = await fetch(image.source);

  if (!response.ok) {
    throw new Error(`Image request failed with ${response.status}.`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const [, base64Payload] = dataUrl.split(",", 2);

  if (!base64Payload) {
    throw new Error("Invalid data URL.");
  }

  const binaryString = atob(base64Payload);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}

async function appendImagePlaceholder(frame: FrameNode, alt: string | undefined) {
  const placeholderText = figma.createText();

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  frame.layoutMode = "VERTICAL";
  frame.primaryAxisAlignItems = "CENTER";
  frame.counterAxisAlignItems = "CENTER";

  placeholderText.characters = alt?.trim() || "Image";
  placeholderText.fontName = { family: "Inter", style: "Regular" };
  placeholderText.fontSize = 12;
  placeholderText.fills = [...DEFAULT_TEXT_COLOR];

  frame.appendChild(placeholderText);
}

function stringifyFontName(fontName: FontName): string {
  return `${fontName.family}::${fontName.style}`;
}

function toSolidPaint(color: ColorHint): SolidPaint {
  return {
    type: "SOLID",
    color: {
      r: color.r,
      g: color.g,
      b: color.b
    },
    opacity: color.opacity
  };
}

function mapPrimaryAlignment(
  value: LayoutHints["justifyContent"]
): FrameNode["primaryAxisAlignItems"] {
  switch (value) {
    case "CENTER":
      return "CENTER";
    case "FLEX_END":
      return "MAX";
    case "SPACE_BETWEEN":
      return "SPACE_BETWEEN";
    default:
      return "MIN";
  }
}

function mapCounterAlignment(
  value: LayoutHints["alignItems"]
): FrameNode["counterAxisAlignItems"] {
  switch (value) {
    case "CENTER":
      return "CENTER";
    case "FLEX_END":
      return "MAX";
    default:
      return "MIN";
  }
}
