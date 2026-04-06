import type {
  ColorHint,
  DesignPlanDocument,
  DesignPlanNode,
  FontStyleHint,
  ImageHint,
  LayoutHints,
  ShadowHint,
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
  applyNodeDecorations(frame, node.appearance);

  applyFrameLayout(frame, node.layout);
  await applyImageAwareFills(frame, node.appearance.fills, node.appearance.image);

  for (const childNode of node.children) {
    const sceneChild = await createSceneNode(childNode);
    appendSceneChild(frame, sceneChild, childNode, node.layout);
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
  textNode.textAutoResize =
    node.layout.width || node.layout.maxWidth ? "HEIGHT" : "WIDTH_AND_HEIGHT";

  if (node.layout.width) {
    textNode.resize(node.layout.width, textNode.height);
  } else if (node.layout.maxWidth) {
    textNode.resize(node.layout.maxWidth, textNode.height);
  }

  applyTextSegments(textNode, segments);
  applyMinMaxSizing(textNode, node.layout);

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
  frame.clipsContent = true;
  frame.resize(width, height);
  applyNodeDecorations(frame, node.appearance);

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
  frame.layoutWrap = layout.wrap;
  frame.itemSpacing = layout.gap;
  frame.counterAxisSpacing = layout.wrap === "WRAP" ? layout.crossGap : null;
  frame.paddingTop = layout.padding.top;
  frame.paddingRight = layout.padding.right;
  frame.paddingBottom = layout.padding.bottom;
  frame.paddingLeft = layout.padding.left;
  frame.clipsContent = layout.clipsContent;
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

  applyMinMaxSizing(frame, layout);
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

function appendSceneChild(
  parentFrame: FrameNode,
  sceneChild: SceneNode,
  childNode: DesignPlanNode,
  parentLayout: LayoutHints
) {
  const parentChild = shouldWrapMargin(childNode)
    ? wrapSceneChildWithMargin(sceneChild, childNode)
    : sceneChild;

  parentFrame.appendChild(parentChild);

  if (childNode.item.position === "ABSOLUTE") {
    applyAbsolutePlacement(sceneChild, childNode, parentLayout);
    return;
  }

  applyAutoLayoutChildBehavior(parentChild, childNode, parentLayout);

  if (parentChild !== sceneChild) {
    applyNestedChildSizing(sceneChild, childNode, parentLayout);
  }
}

function shouldWrapMargin(node: DesignPlanNode): boolean {
  const margin = node.item.margin;

  return (
    node.item.position !== "ABSOLUTE" &&
    (margin.top > 0 || margin.right > 0 || margin.bottom > 0 || margin.left > 0)
  );
}

function wrapSceneChildWithMargin(
  sceneChild: SceneNode,
  childNode: DesignPlanNode
): FrameNode {
  const wrapper = figma.createFrame();
  const margin = childNode.item.margin;

  wrapper.name = `${childNode.name} Margin`;
  wrapper.layoutMode = "VERTICAL";
  wrapper.primaryAxisSizingMode = "AUTO";
  wrapper.counterAxisSizingMode = "AUTO";
  wrapper.itemSpacing = 0;
  wrapper.paddingTop = margin.top;
  wrapper.paddingRight = margin.right;
  wrapper.paddingBottom = margin.bottom;
  wrapper.paddingLeft = margin.left;
  wrapper.fills = [];
  wrapper.strokes = [];
  wrapper.effects = [];
  wrapper.clipsContent = false;
  wrapper.appendChild(sceneChild);

  return wrapper;
}

function applyAutoLayoutChildBehavior(
  sceneChild: SceneNode,
  childNode: DesignPlanNode,
  parentLayout: LayoutHints
) {
  if ("layoutAlign" in sceneChild) {
    sceneChild.layoutAlign = mapChildAlignment(
      childNode.item.alignSelf,
      parentLayout.alignItems
    );
  }

  if ("layoutGrow" in sceneChild) {
    sceneChild.layoutGrow = childNode.item.flexGrow > 0 ? childNode.item.flexGrow : 0;
  }

  applyFlexBasis(sceneChild, childNode, parentLayout);
  applyMinMaxSizing(sceneChild, childNode.layout);
}

function applyNestedChildSizing(
  sceneChild: SceneNode,
  childNode: DesignPlanNode,
  parentLayout: LayoutHints
) {
  if ("layoutAlign" in sceneChild) {
    sceneChild.layoutAlign = mapChildAlignment(
      childNode.item.alignSelf,
      parentLayout.alignItems
    );
  }

  applyFlexBasis(sceneChild, childNode, parentLayout);
  applyMinMaxSizing(sceneChild, childNode.layout);
}

function applyAbsolutePlacement(
  sceneChild: SceneNode,
  childNode: DesignPlanNode,
  parentLayout: LayoutHints
) {
  if ("layoutPositioning" in sceneChild) {
    sceneChild.layoutPositioning = "ABSOLUTE";
  }

  const width = "width" in sceneChild ? sceneChild.width : childNode.layout.width;
  const height = "height" in sceneChild ? sceneChild.height : childNode.layout.height;
  const inset = childNode.item.inset;
  const absoluteX = resolveAbsoluteCoordinate(
    inset.left,
    inset.right,
    parentLayout.width,
    width
  );
  const absoluteY = resolveAbsoluteCoordinate(
    inset.top,
    inset.bottom,
    parentLayout.height,
    height
  );

  if (absoluteX !== undefined && "x" in sceneChild) {
    sceneChild.x = absoluteX;
  }

  if (absoluteY !== undefined && "y" in sceneChild) {
    sceneChild.y = absoluteY;
  }

  applyMinMaxSizing(sceneChild, childNode.layout);
}

function applyNodeDecorations(
  frame: FrameNode,
  appearance: DesignPlanNode["appearance"]
) {
  frame.cornerRadius = appearance.cornerRadius ?? 0;
  frame.opacity = appearance.opacity ?? 1;
  frame.strokes = appearance.strokes.map((stroke) => toSolidPaint(stroke.color));
  frame.strokeWeight = appearance.strokes[0]?.weight ?? 0;
  frame.strokeAlign = "INSIDE";
  frame.effects = appearance.shadows.map(toShadowEffect);
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

function toShadowEffect(shadow: ShadowHint): DropShadowEffect | InnerShadowEffect {
  return {
    type: shadow.type,
    color: {
      r: shadow.color.r,
      g: shadow.color.g,
      b: shadow.color.b,
      a: shadow.color.opacity
    },
    offset: {
      x: shadow.offsetX,
      y: shadow.offsetY
    },
    radius: shadow.blur,
    spread: 0,
    visible: true,
    blendMode: "NORMAL"
  };
}

function applyFlexBasis(
  sceneChild: SceneNode,
  childNode: DesignPlanNode,
  parentLayout: LayoutHints
) {
  const basis = childNode.item.flexBasis;

  if (basis === undefined) {
    return;
  }

  if (parentLayout.mode === "HORIZONTAL") {
    resizeSceneNode(sceneChild, basis, childNode.layout.height);
    return;
  }

  if (parentLayout.mode === "VERTICAL") {
    resizeSceneNode(sceneChild, childNode.layout.width, basis);
  }
}

function resizeSceneNode(
  sceneChild: SceneNode,
  width: number | undefined,
  height: number | undefined
) {
  if (!("resize" in sceneChild)) {
    return;
  }

  const nextWidth = width ?? ("width" in sceneChild ? sceneChild.width : undefined);
  const nextHeight =
    height ?? ("height" in sceneChild ? sceneChild.height : undefined);

  if (nextWidth !== undefined && nextHeight !== undefined) {
    sceneChild.resize(nextWidth, nextHeight);
  }
}

function applyMinMaxSizing(
  sceneChild: SceneNode,
  layout: LayoutHints
) {
  if ("minWidth" in sceneChild) {
    sceneChild.minWidth = layout.minWidth ?? null;
    sceneChild.maxWidth = layout.maxWidth ?? null;
    sceneChild.minHeight = layout.minHeight ?? null;
    sceneChild.maxHeight = layout.maxHeight ?? null;
  }
}

function mapChildAlignment(
  alignSelf: DesignPlanNode["item"]["alignSelf"],
  parentAlignItems: LayoutHints["alignItems"]
): AutoLayoutChildrenMixin["layoutAlign"] {
  switch (alignSelf) {
    case "CENTER":
      return "CENTER";
    case "FLEX_END":
      return "MAX";
    case "STRETCH":
      return "STRETCH";
    case "FLEX_START":
      return "MIN";
    default:
      return parentAlignItems === "STRETCH" ? "STRETCH" : "INHERIT";
  }
}

function resolveAbsoluteCoordinate(
  start: number | undefined,
  end: number | undefined,
  parentSize: number | undefined,
  childSize: number | undefined
): number | undefined {
  if (start !== undefined) {
    return start;
  }

  if (
    end !== undefined &&
    parentSize !== undefined &&
    childSize !== undefined
  ) {
    return Math.max(parentSize - childSize - end, 0);
  }

  return undefined;
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
