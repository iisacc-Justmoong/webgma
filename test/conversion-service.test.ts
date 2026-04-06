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
    expect(result.warnings[0]).toMatch(/image assets/i);
  });

  it("surfaces flattening diagnostics when CSS is forced into a single inline HTML", () => {
    const result = convertHtmlCssToDesign({
      html: {
        content: '<div class="card">Hello</div>',
        mode: "code"
      },
      css: {
        content: `
          @media (min-width: 700px) {
            .card { color: #ff0000; }
          }

          .card:hover {
            color: #00ff00;
          }

          .card {
            padding: 16px;
          }
        `,
        mode: "code"
      }
    });

    expect(result.mergedHtml).toMatch(/padding:\s*16px/i);
    expect(result.mergedHtml).toMatch(/color:\s*#00ff00/i);
    expect(result.warnings).toContain(
      "Conditional at-rule flattened during CSS inlining: @media."
    );
    expect(result.warnings).toContain(
      "State selector flattened onto the base element during CSS inlining: .card:hover."
    );
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
