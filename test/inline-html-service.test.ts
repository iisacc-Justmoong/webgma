import { describe, expect, it } from "vitest";
import {
  mergeHtmlWithCss,
  mergeHtmlWithCssWithDiagnostics
} from "../src/shared/services/inline-html-service.js";

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

  it("inlines embedded style tags even when no external CSS input is provided", () => {
    const mergedHtml = mergeHtmlWithCss(
      `
        <html>
          <head>
            <style>
              .card {
                display: flex;
                padding: 14px;
              }
            </style>
          </head>
          <body>
            <div class="card">Hello</div>
          </body>
        </html>
      `,
      ""
    );

    expect(mergedHtml).not.toMatch(/<style[\s>]/i);
    expect(mergedHtml).toMatch(/display:\s*flex/i);
    expect(mergedHtml).toMatch(/padding:\s*14px/i);
  });

  it("removes stylesheet tags and links from the merged single HTML output", () => {
    const mergedHtml = mergeHtmlWithCss(
      `<!doctype html>
      <html>
        <head>
          <style>.legacy { color: #ff0000; }</style>
          <link rel="stylesheet" href="/legacy.css" />
          <link rel="preconnect" href="https://example.com" />
        </head>
        <body>
          <div class="card">Hello</div>
        </body>
      </html>`,
      ".card { display: flex; color: #123456; padding: 12px; }"
    );

    expect(mergedHtml).not.toMatch(/<style[\s>]/i);
    expect(mergedHtml).not.toMatch(/rel=["']stylesheet["']/i);
    expect(mergedHtml).toMatch(/rel=["']preconnect["']/i);
    expect(mergedHtml).toMatch(/display:\s*flex/i);
    expect(mergedHtml).toMatch(/color:\s*#123456/i);
    expect(mergedHtml).toMatch(/padding:\s*12px/i);
  });

  it("flattens embedded styles, conditional rules, and state selectors into inline HTML", () => {
    const mergeResult = mergeHtmlWithCssWithDiagnostics(
      `
        <html>
          <head>
            <style>.card { border-radius: 8px; }</style>
          </head>
          <body>
            <div class="card">Hello</div>
          </body>
        </html>
      `,
      `
        @media (min-width: 700px) {
          .card { color: #ff0000; }
        }

        .card:hover {
          color: #00ff00;
        }

        .card {
          display: flex;
          padding: 10px;
        }
      `
    );

    expect(mergeResult.mergedHtml).toMatch(/display:\s*flex/i);
    expect(mergeResult.mergedHtml).toMatch(/padding:\s*10px/i);
    expect(mergeResult.mergedHtml).toMatch(/border-radius:\s*8px/i);
    expect(mergeResult.mergedHtml).toMatch(/color:\s*#00ff00/i);
    expect(mergeResult.warnings).toContain(
      "Conditional at-rule flattened during CSS inlining: @media."
    );
    expect(mergeResult.warnings).toContain(
      "State selector flattened onto the base element during CSS inlining: .card:hover."
    );
  });

  it("rejects empty HTML input", () => {
    expect(() => mergeHtmlWithCss("   ", "body { color: red; }")).toThrow(
      "HTML content is required."
    );
  });
});
