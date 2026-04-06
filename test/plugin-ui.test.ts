import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("plugin UI", () => {
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
});
