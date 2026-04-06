import { describe, expect, it } from "vitest";
import { mergeHtmlWithCss } from "../src/shared/services/inline-html-service.js";

describe("mergeHtmlWithCss", () => {
  it("inlines CSS declarations into the HTML source", () => {
    const mergedHtml = mergeHtmlWithCss(
      '<div class="card"><span>Hello</span></div>',
      ".card { display: flex; gap: 12px; padding: 8px; background: #112233; } span { color: #ffffff; font-size: 18px; }"
    );

    expect(mergedHtml).toMatch(/display:\s*flex/i);
    expect(mergedHtml).toMatch(/gap:\s*12px/i);
    expect(mergedHtml).toMatch(/padding:\s*8px/i);
    expect(mergedHtml).toMatch(/font-size:\s*18px/i);
  });

  it("applies more specific selectors over less specific selectors", () => {
    const mergedHtml = mergeHtmlWithCss(
      '<div id="hero" class="card">Hello</div>',
      "div { color: #111111; } .card { color: #222222; } #hero { color: #333333; }"
    );

    expect(mergedHtml).toMatch(/color:\s*#333333/i);
  });

  it("rejects empty HTML input", () => {
    expect(() => mergeHtmlWithCss("   ", "body { color: red; }")).toThrow(
      "HTML content is required."
    );
  });
});
