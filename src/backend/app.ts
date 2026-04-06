import express from "express";
import type {
  ConversionRequest,
  ConversionResponse,
  SourceInput
} from "../shared/contracts.js";
import { createDesignPlan } from "./services/design-plan-service.js";
import { mergeHtmlWithCss } from "./services/inline-html-service.js";

const CSS_SUPPORT_WARNING =
  "Current scaffold maps inline styles, flex auto layout, spacing, solid fills, and basic text styles.";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post("/v1/convert", (request, response) => {
    try {
      const payload = normalizeConversionRequest(request.body);
      const mergedHtml = mergeHtmlWithCss(
        payload.html.content,
        payload.css.content
      );
      const designPlan = createDesignPlan(mergedHtml);
      const body: ConversionResponse = {
        mergedHtml,
        designPlan,
        warnings: [CSS_SUPPORT_WARNING]
      };

      response.json(body);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected conversion error.";

      response.status(400).json({ error: message });
    }
  });

  return app;
}

function normalizeConversionRequest(value: unknown): ConversionRequest {
  if (!isRecord(value)) {
    throw new Error("Request body must be an object.");
  }

  return {
    html: normalizeSourceInput(value.html, "html"),
    css: normalizeSourceInput(value.css, "css")
  };
}

function normalizeSourceInput(value: unknown, label: string): SourceInput {
  if (!isRecord(value)) {
    throw new Error(`${label.toUpperCase()} input must be an object.`);
  }

  const content = value.content;
  const mode = value.mode;
  const name = value.name;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`${label.toUpperCase()} content is required.`);
  }

  if (mode !== "code" && mode !== "file") {
    throw new Error(`${label.toUpperCase()} mode must be "code" or "file".`);
  }

  if (name !== undefined && typeof name !== "string") {
    throw new Error(`${label.toUpperCase()} name must be a string when provided.`);
  }

  return {
    content,
    mode,
    name
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
