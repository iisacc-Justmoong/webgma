import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("render design plan", () => {
  it("applies appearance and child-placement hints to Figma nodes", () => {
    const renderCode = readFileSync(
      resolve(process.cwd(), "src/plugin/render-design-plan.ts"),
      "utf8"
    );

    expect(renderCode).toContain("frame.strokes = appearance.strokes.map");
    expect(renderCode).toContain('frame.strokeAlign = "INSIDE"');
    expect(renderCode).toContain("frame.effects = appearance.shadows.map");
    expect(renderCode).toContain("function toShadowEffect");
    expect(renderCode).toContain("frame.layoutWrap = layout.wrap");
    expect(renderCode).toContain("sceneChild.layoutPositioning = \"ABSOLUTE\"");
    expect(renderCode).toContain("sceneChild.layoutGrow = childNode.item.flexGrow");
    expect(renderCode).toContain("wrapSceneChildWithMargin");
    expect(renderCode).toContain("node.layout.width || node.layout.maxWidth ? \"HEIGHT\"");
    expect(renderCode).toContain("textNode.resize(node.layout.maxWidth, textNode.height)");
  });
});
