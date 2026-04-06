import type { ConversionRequest } from "../shared/contracts.js";
import { convertHtmlCssToDesign } from "../shared/services/conversion-service.js";
import { renderDesignPlan } from "./render-design-plan.js";

declare const __PLUGIN_UI_HTML__: string;

const DEFAULT_UI_SIZE = {
  width: 1080,
  height: 860
} as const;
const MIN_UI_WIDTH = 720;
const MIN_UI_HEIGHT = 560;
const MAX_UI_WIDTH = 1600;
const MAX_UI_HEIGHT = 1400;

figma.showUI(__PLUGIN_UI_HTML__, {
  width: DEFAULT_UI_SIZE.width,
  height: DEFAULT_UI_SIZE.height,
  themeColors: true
});

figma.ui.onmessage = async (message: unknown) => {
  if (!isPluginMessage(message)) {
    return;
  }

  if (message.type === "convert") {
    await handleConvertMessage(message.payload);
  }

  if (message.type === "close") {
    figma.closePlugin();
  }

  if (message.type === "resize-ui") {
    resizePluginUi(message.payload);
  }
};

async function handleConvertMessage(payload: ConversionRequest) {
  try {
    figma.notify("Starting static HTML/CSS analysis...");
    const conversionResponse = convertHtmlCssToDesign(payload);
    const renderedNode = await renderDesignPlan(conversionResponse.designPlan);

    figma.currentPage.selection = [renderedNode];
    figma.viewport.scrollAndZoomIntoView([renderedNode]);

    figma.ui.postMessage({
      type: "convert:success",
      payload: conversionResponse
    });
    figma.notify("Figma layout created from static HTML/CSS analysis.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected conversion error.";

    figma.ui.postMessage({
      type: "convert:error",
      payload: {
        message
      }
    });
    figma.notify(message, { error: true });
  }
}

function isPluginMessage(
  value: unknown
): value is
  | { type: "convert"; payload: ConversionRequest }
  | { type: "close" }
  | { type: "resize-ui"; payload: { width: number; height: number } } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { type?: unknown };

  return (
    candidate.type === "convert" ||
    candidate.type === "close" ||
    candidate.type === "resize-ui"
  );
}

function resizePluginUi(payload: { width: number; height: number }) {
  figma.ui.resize(
    clampDimension(payload.width, MIN_UI_WIDTH, MAX_UI_WIDTH),
    clampDimension(payload.height, MIN_UI_HEIGHT, MAX_UI_HEIGHT)
  );
}

function clampDimension(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(Math.max(Math.round(value), minimum), maximum);
}
