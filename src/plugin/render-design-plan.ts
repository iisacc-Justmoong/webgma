import type {
  ColorHint,
  DesignPlanDocument,
  DesignPlanNode,
  LayoutHints
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

  const frame = figma.createFrame();
  frame.name = node.name;
  frame.fills = node.appearance.fills.length
    ? node.appearance.fills.map(toSolidPaint)
    : [];
  frame.cornerRadius = node.appearance.cornerRadius ?? 0;
  frame.opacity = node.appearance.opacity ?? 1;

  applyFrameLayout(frame, node.layout);

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
  const fontName = resolveFontName(node.text?.fontWeight);

  await figma.loadFontAsync(fontName);

  textNode.name = node.name;
  textNode.fontName = fontName;
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

  return textNode;
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

function resolveFontName(weight: number | undefined): FontName {
  if ((weight ?? 400) >= 700) {
    return { family: "Inter", style: "Bold" };
  }

  return { family: "Inter", style: "Regular" };
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
