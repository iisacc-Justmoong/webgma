import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("plugin code", () => {
  it("handles UI resize messages through figma.ui.resize", () => {
    const pluginCode = readFileSync(
      resolve(process.cwd(), "src/plugin/code.ts"),
      "utf8"
    );

    expect(pluginCode).toContain('type: "resize-ui"');
    expect(pluginCode).toContain("figma.ui.resize");
    expect(pluginCode).toContain("figma.ui.show()");
    expect(pluginCode).toContain("visible: false");
    expect(pluginCode).toContain("hasShownUi");
    expect(pluginCode).toContain("clampDimension");
    expect(pluginCode).toContain("MIN_UI_WIDTH");
    expect(pluginCode).toContain("MAX_UI_HEIGHT");
  });
});
