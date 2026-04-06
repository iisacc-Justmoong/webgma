import type { ConversionRequest } from "../shared/contracts.js";
import { convertHtmlCssToDesign } from "../shared/services/conversion-service.js";
import { renderDesignPlan } from "./render-design-plan.js";

declare const __PLUGIN_UI_HTML__: string;

figma.showUI(__PLUGIN_UI_HTML__, {
  width: 1080,
  height: 760,
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
  | { type: "close" } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { type?: unknown };

  return candidate.type === "convert" || candidate.type === "close";
}
