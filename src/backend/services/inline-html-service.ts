import juice from "juice";

export function mergeHtmlWithCss(html: string, css: string): string {
  const normalizedHtml = html.trim();

  if (!normalizedHtml) {
    throw new Error("HTML content is required.");
  }

  return juice.inlineContent(normalizedHtml, css.trim());
}
