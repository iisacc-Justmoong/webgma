import { HTMLElement, parse } from "node-html-parser";
import type { SourceInput } from "../contracts.js";

export interface LoadedCssSource {
  content: string;
  name: string;
  origin: "embedded-style" | "input-css";
}

export interface CssContentLoadResult {
  css: string;
  documentNode: HTMLElement;
  html: string;
  sources: LoadedCssSource[];
  warnings: string[];
}

export function loadCssContent(
  htmlInput: SourceInput | string,
  cssInput: SourceInput | string
): CssContentLoadResult {
  const htmlContent =
    typeof htmlInput === "string" ? htmlInput : htmlInput.content;
  const cssContent =
    typeof cssInput === "string" ? cssInput : cssInput.content;
  const normalizedHtml = normalizeHtmlSource(htmlContent);

  if (!normalizedHtml) {
    throw new Error("HTML content is required.");
  }

  const documentNode = parse(normalizedHtml, {
    blockTextElements: {
      script: false,
      noscript: false,
      style: true,
      pre: true
    }
  });
  const embeddedSources = collectEmbeddedStyleSources(documentNode);
  const warnings = removeStylesheetDependencies(documentNode);
  const inputSourceName =
    typeof cssInput === "string"
      ? "input.css"
      : cssInput.name || (cssInput.mode === "file" ? "input.css" : "inline.css");
  const sources = [
    ...embeddedSources,
    {
      content: cssContent.trim(),
      name: inputSourceName,
      origin: "input-css" as const
    }
  ].filter((source) => source.content.length > 0);

  return {
    css: sources.map((source) => source.content).join("\n"),
    documentNode,
    html: documentNode.toString(),
    sources,
    warnings
  };
}

export function normalizeHtmlSource(html: string): string {
  const trimmedHtml = html.trim();

  if (
    !trimmedHtml ||
    containsHtmlLikeMarkup(trimmedHtml) ||
    !looksLikeEscapedHtml(trimmedHtml)
  ) {
    return trimmedHtml;
  }

  return decodeHtmlEntities(trimmedHtml).trim();
}

function collectEmbeddedStyleSources(documentNode: HTMLElement): LoadedCssSource[] {
  return documentNode
    .querySelectorAll("style")
    .map((styleElement, index) => ({
      content: styleElement.innerHTML.trim(),
      name: `embedded-style-${index + 1}.css`,
      origin: "embedded-style" as const
    }))
    .filter((source) => source.content.length > 0);
}

function removeStylesheetDependencies(documentNode: HTMLElement): string[] {
  const warnings: string[] = [];

  for (const styleElement of documentNode.querySelectorAll("style")) {
    styleElement.remove();
  }

  for (const linkElement of documentNode.querySelectorAll("link")) {
    const relAttribute = (linkElement.getAttribute("rel") ?? "")
      .toLowerCase()
      .trim();
    const relTokens = relAttribute.split(/\s+/).filter(Boolean);

    if (relTokens.includes("stylesheet")) {
      const href = linkElement.getAttribute("href") ?? "";

      if (href.trim()) {
        warnings.push(`Stylesheet dependency removed from HTML during CSS loading: ${href}.`);
      }

      linkElement.remove();
    }
  }

  return warnings;
}

function containsHtmlLikeMarkup(value: string): boolean {
  return /<\/?[a-zA-Z!][^>]*>/.test(value);
}

function looksLikeEscapedHtml(value: string): boolean {
  return /&lt;\/?[a-zA-Z!][^&]*&gt;/.test(value);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, codePoint) =>
      String.fromCodePoint(Number.parseInt(codePoint, 10))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16))
    );
}
