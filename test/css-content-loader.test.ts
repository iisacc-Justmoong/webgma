import { describe, expect, it } from "vitest";
import {
  loadCssContent,
  normalizeHtmlSource
} from "../src/shared/services/css-content-loader.js";

describe("css-content-loader", () => {
  it("loads embedded styles and input CSS into ordered sources", () => {
    const result = loadCssContent(
      {
        content: `
          <html>
            <head>
              <style>.hero { display: flex; }</style>
              <style>.hero p { color: #ffffff; }</style>
            </head>
            <body>
              <section class="hero">
                <p>Hello</p>
              </section>
            </body>
          </html>
        `,
        mode: "code",
        name: "page.html"
      },
      {
        content: ".hero { padding: 24px; }",
        mode: "file",
        name: "tokens.css"
      }
    );

    expect(result.sources).toEqual([
      {
        content: ".hero { display: flex; }",
        name: "embedded-style-1.css",
        origin: "embedded-style"
      },
      {
        content: ".hero p { color: #ffffff; }",
        name: "embedded-style-2.css",
        origin: "embedded-style"
      },
      {
        content: ".hero { padding: 24px; }",
        name: "tokens.css",
        origin: "input-css"
      }
    ]);
    expect(result.css).toContain(".hero { display: flex; }");
    expect(result.css).toContain(".hero p { color: #ffffff; }");
    expect(result.css).toContain(".hero { padding: 24px; }");
  });

  it("removes stylesheet dependencies while preserving non-stylesheet links", () => {
    const result = loadCssContent(
      {
        content: `
          <!doctype html>
          <html>
            <head>
              <style>.hero { display: flex; }</style>
              <link rel="stylesheet preload" href="/styles/site.css" />
              <link rel="preconnect" href="https://example.com" />
            </head>
            <body>
              <section class="hero">Hello</section>
            </body>
          </html>
        `,
        mode: "file",
        name: "page.html"
      },
      {
        content: "",
        mode: "code"
      }
    );

    expect(result.html).not.toMatch(/<style[\s>]/i);
    expect(result.html).not.toMatch(/rel=["']stylesheet preload["']/i);
    expect(result.html).toMatch(/rel=["']preconnect["']/i);
    expect(result.warnings).toContain(
      "Stylesheet dependency removed from HTML during CSS loading: /styles/site.css."
    );
  });

  it("decodes escaped HTML before parsing CSS content sources", () => {
    const result = loadCssContent(
      {
        content:
          '&lt;html&gt;&lt;head&gt;&lt;style&gt;.card { padding: 12px; }&lt;/style&gt;&lt;/head&gt;&lt;body&gt;&lt;div class="card"&gt;Hello&lt;/div&gt;&lt;/body&gt;&lt;/html&gt;',
        mode: "code"
      },
      {
        content: ".card { color: #ff0000; }",
        mode: "code"
      }
    );

    expect(result.html).toContain('<div class="card">Hello</div>');
    expect(result.html).not.toContain("&lt;div");
    expect(result.sources).toEqual([
      {
        content: ".card { padding: 12px; }",
        name: "embedded-style-1.css",
        origin: "embedded-style"
      },
      {
        content: ".card { color: #ff0000; }",
        name: "inline.css",
        origin: "input-css"
      }
    ]);
  });

  it("normalizes escaped HTML only when the source is not already markup", () => {
    expect(normalizeHtmlSource("  <section>Hello</section>  ")).toBe(
      "<section>Hello</section>"
    );
    expect(
      normalizeHtmlSource("  &lt;section&gt;Hello&lt;/section&gt;  ")
    ).toBe("<section>Hello</section>");
  });
});
