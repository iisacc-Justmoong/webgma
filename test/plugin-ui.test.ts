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
    expect(uiHtml).toContain(
      "Accept HTML code and optional CSS code through two dedicated"
    );
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
    expect(uiHtml).toMatch(/CSS is optional in\s+both modes\./);
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
    expect(uiHtml).toContain("HTML-only conversion is allowed.");
  });

  it("contains resize controls and English-only interface copy", () => {
    const uiHtml = readFileSync(
      resolve(process.cwd(), "src/plugin/ui.html"),
      "utf8"
    );

    expect(uiHtml).toContain('id="resize-edge-right"');
    expect(uiHtml).toContain('id="resize-edge-bottom"');
    expect(uiHtml).toContain('id="resize-corner"');
    expect(uiHtml).toContain('startResizeDrag("right"');
    expect(uiHtml).toContain('startResizeDrag("bottom"');
    expect(uiHtml).toContain('startResizeDrag("corner"');
    expect(uiHtml).toContain('type: "resize-ui"');
    expect(uiHtml).toContain("syncUiToContentSize()");
    expect(uiHtml).toContain("measureContentSize()");
    expect(uiHtml).toContain("requestAnimationFrame");
    expect(uiHtml).not.toContain('class="secondary size-preset"');
    expect(uiHtml).not.toContain("window-actions");
    expect(uiHtml).not.toContain("Window Size");
    expect(uiHtml).not.toMatch(/[가-힣]/);
  });

  it("does not include sample controls or preview sections", () => {
    const uiHtml = readFileSync(
      resolve(process.cwd(), "src/plugin/ui.html"),
      "utf8"
    );

    expect(uiHtml).not.toContain("Load sample");
    expect(uiHtml).not.toContain("Merged HTML preview");
    expect(uiHtml).not.toContain("merged-output");
    expect(uiHtml).not.toContain("isBrowserPreviewMode");
    expect(uiHtml).not.toContain("htmlSample");
    expect(uiHtml).not.toContain("cssSample");
    expect(uiHtml).toContain("Mode 1 requires an HTML file.");
    expect(uiHtml).not.toContain("Mode 1 requires a CSS file.");
    expect(uiHtml).toContain("CSS file is optional.");
    expect(uiHtml).toContain("CSS code is optional.");
    expect(uiHtml).toContain("Waiting for HTML code. CSS code is optional.");
    expect(uiHtml).toContain("Mode 2 is active. Enter HTML code. CSS code is optional.");
  });
});
