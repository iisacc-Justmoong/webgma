import type {
  ConversionRequest,
  ConversionResponse,
  SourceInput
} from "../contracts.js";
import { createDesignPlan } from "./design-plan-service.js";
import { mergeHtmlWithCssWithDiagnostics } from "./inline-html-service.js";

const STATIC_ANALYSIS_WARNING =
  "Current static analysis maps inline styles, flex auto layout, spacing, image assets, and mixed text styles.";

export function convertHtmlCssToDesign(
  request: ConversionRequest
): ConversionResponse {
  const normalizedRequest = normalizeConversionRequest(request);
  const mergeResult = mergeHtmlWithCssWithDiagnostics(
    normalizedRequest.html.content,
    normalizedRequest.css.content
  );
  const mergedHtml = mergeResult.mergedHtml;

  return {
    mergedHtml,
    designPlan: createDesignPlan(mergedHtml),
    warnings: [STATIC_ANALYSIS_WARNING, ...mergeResult.warnings]
  };
}

export function normalizeConversionRequest(
  value: unknown
): ConversionRequest {
  if (typeof value !== "object" || value === null) {
    throw new Error("Request body must be an object.");
  }

  const candidate = value as {
    css?: unknown;
    html?: unknown;
  };

  return {
    html: normalizeSourceInput(candidate.html, "html"),
    css: normalizeSourceInput(candidate.css, "css")
  };
}

export function normalizeSourceInput(
  value: unknown,
  label: string
): SourceInput {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${label.toUpperCase()} input must be an object.`);
  }

  const candidate = value as {
    content?: unknown;
    mode?: unknown;
    name?: unknown;
  };
  const content = candidate.content;
  const mode = candidate.mode;
  const name = candidate.name;

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
