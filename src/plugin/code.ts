import type {
  ConversionRequest,
  ConversionResponse
} from "../shared/contracts.js";
import { renderDesignPlan } from "./render-design-plan.js";

declare const __PLUGIN_UI_HTML__: string;

const DEFAULT_BACKEND_URL = "http://localhost:8787";

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

async function handleConvertMessage(
  payload: ConversionRequest & { backendUrl?: string }
) {
  try {
    figma.notify("Starting HTML/CSS conversion...");
    const conversionResponse = await requestConversion(payload);
    const renderedNode = await renderDesignPlan(conversionResponse.designPlan);

    figma.currentPage.selection = [renderedNode];
    figma.viewport.scrollAndZoomIntoView([renderedNode]);

    figma.ui.postMessage({
      type: "convert:success",
      payload: conversionResponse
    });
    figma.notify("Figma layout created from merged HTML.");
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

async function requestConversion(
  payload: ConversionRequest & { backendUrl?: string }
): Promise<ConversionResponse> {
  const backendUrl = normalizeBackendUrl(payload.backendUrl);
  const response = await fetch(`${backendUrl}/v1/convert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      html: payload.html,
      css: payload.css
    } satisfies ConversionRequest)
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(errorBody?.error ?? "Backend conversion request failed.");
  }

  return (await response.json()) as ConversionResponse;
}

function normalizeBackendUrl(value: string | undefined): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return DEFAULT_BACKEND_URL;
  }

  return normalizedValue.replace(/\/$/, "");
}

function isPluginMessage(
  value: unknown
): value is
  | { type: "convert"; payload: ConversionRequest & { backendUrl?: string } }
  | { type: "close" } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { type?: unknown };

  return candidate.type === "convert" || candidate.type === "close";
}
