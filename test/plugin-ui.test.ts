import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("plugin UI", () => {
  it("contains file mode and code mode selectors", () => {
    const uiHtml = readFileSync(
      resolve(process.cwd(), "src/plugin/ui.html"),
      "utf8"
    );

    expect(uiHtml).toContain('id="input-mode-file"');
    expect(uiHtml).toContain("Mode 1 · File Input");
    expect(uiHtml).toContain('id="input-mode-code"');
    expect(uiHtml).toContain("Mode 2 · Code Input");
  });

  it("contains dedicated HTML and CSS code input editors", () => {
    const uiHtml = readFileSync(
      resolve(process.cwd(), "src/plugin/ui.html"),
      "utf8"
    );

    expect(uiHtml).toContain('for="html-input"');
    expect(uiHtml).toContain("HTML Code");
    expect(uiHtml).toContain('id="html-input"');
    expect(uiHtml).toContain('aria-label="HTML code input"');
    expect(uiHtml).toContain('placeholder="Paste HTML code here"');

    expect(uiHtml).toContain('for="css-input"');
    expect(uiHtml).toContain("CSS Code");
    expect(uiHtml).toContain('id="css-input"');
    expect(uiHtml).toContain('aria-label="CSS code input"');
    expect(uiHtml).toContain('placeholder="Paste CSS code here"');
  });

  it("contains dedicated HTML and CSS file inputs", () => {
    const uiHtml = readFileSync(
      resolve(process.cwd(), "src/plugin/ui.html"),
      "utf8"
    );

    expect(uiHtml).toContain('id="html-file-panel"');
    expect(uiHtml).toContain('id="html-file"');
    expect(uiHtml).toContain("HTML File");
    expect(uiHtml).toContain('id="css-file-panel"');
    expect(uiHtml).toContain('id="css-file"');
    expect(uiHtml).toContain("CSS File");
  });

  it("supports browser preview mode messaging", () => {
    const uiHtml = readFileSync(
      resolve(process.cwd(), "src/plugin/ui.html"),
      "utf8"
    );

    expect(uiHtml).toContain("const isBrowserPreviewMode = window.parent === window;");
    expect(uiHtml).toContain("Browser preview mode");
    expect(uiHtml).toContain("previewConversion(payload);");
    expect(uiHtml).toContain("Mode 1 requires an HTML file.");
    expect(uiHtml).toContain("Mode 1 requires a CSS file.");
  });
});
