import { describe, expect, it } from "vitest";
import { convertHtmlCssToDesign } from "../src/shared/services/conversion-service.js";

describe("convertHtmlCssToDesign", () => {
  it("converts HTML/CSS sources through static analysis", () => {
    const result = convertHtmlCssToDesign({
      html: {
        content: '<section class="hero"><h1>Hello</h1></section>',
        mode: "code"
      },
      css: {
        content:
          ".hero { display: flex; padding: 32px; background: #0f172a; } h1 { font-size: 28px; color: #ffffff; }",
        mode: "code"
      }
    });

    expect(result.mergedHtml).toMatch(/padding:\s*32px/i);
    expect(result.designPlan.root.children).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/Current static analysis maps inline styles/i);
  });

  it("validates missing HTML and CSS content", () => {
    expect(() =>
      convertHtmlCssToDesign({
        html: {
          content: "",
          mode: "code"
        },
        css: {
          content: "body { color: red; }",
          mode: "code"
        }
      })
    ).toThrow("HTML content is required.");
  });

  it("rejects malformed request objects", () => {
    expect(() => convertHtmlCssToDesign(undefined as never)).toThrow(
      "Request body must be an object."
    );
  });
});
