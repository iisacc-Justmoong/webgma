import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";
import {
  mergeTextStyles,
  parseInlineStyle,
  reinterpretFrameStylesForFigma,
  reinterpretImageStylesForFigma,
  reinterpretTextSegmentStylesForFigma,
  reinterpretTextStylesForFigma
} from "../src/shared/services/figma-style-interpreter.js";

describe("figma-style-interpreter", () => {
  it("reinterprets frame styles into Figma layout, item, and appearance hints", () => {
    const styles = parseInlineStyle(
      "display:flex;flex-direction:column;gap:16px 24px;padding:20px;flex-wrap:wrap;overflow:hidden;border:2px solid #cbd5e1;box-shadow:0 12px 24px rgba(15, 23, 42, 0.16);background:#ffffff;"
    );

    const result = reinterpretFrameStylesForFigma(styles, 2, false);

    expect(result.layout.mode).toBe("VERTICAL");
    expect(result.layout.gap).toBe(16);
    expect(result.layout.crossGap).toBe(24);
    expect(result.layout.wrap).toBe("WRAP");
    expect(result.layout.padding.top).toBe(20);
    expect(result.layout.clipsContent).toBe(true);
    expect(result.appearance.fills[0]).toMatchObject({
      r: 1,
      g: 1,
      b: 1,
      opacity: 1
    });
    expect(result.appearance.strokes[0].weight).toBe(2);
    expect(result.appearance.shadows[0].offsetY).toBe(12);
  });

  it("reinterprets text styles and text segments into Figma text hints", () => {
    const inherited = parseInlineStyle("color:#2563eb;font-size:14px;max-width:320px;");
    const styles = mergeTextStyles(
      inherited,
      "strong",
      parseInlineStyle("line-height:20px;letter-spacing:0.5px;")
    );
    const segment = reinterpretTextSegmentStylesForFigma(styles);
    const result = reinterpretTextStylesForFigma(styles, [
      {
        start: 0,
        end: 6,
        ...segment
      }
    ]);

    expect(result.layout.maxWidth).toBe(320);
    expect(result.appearance.fills[0]).toMatchObject({
      r: 37 / 255,
      g: 99 / 255,
      b: 235 / 255,
      opacity: 1
    });
    expect(result.text.fontSize).toBe(14);
    expect(result.text.lineHeight).toBe(20);
    expect(result.text.segments[0].fontWeight).toBe(700);
    expect(result.text.segments[0].letterSpacing).toBe(0.5);
  });

  it("reinterprets image styles into Figma image and sizing hints", () => {
    const documentNode = parse(
      '<img src="https://example.com/hero.png" alt="Hero" width="320" height="180" />'
    );
    const element = documentNode.querySelector("img");

    expect(element).not.toBeNull();

    const result = reinterpretImageStylesForFigma(
      element!,
      parseInlineStyle("object-fit:contain;max-width:400px;opacity:0.85;")
    );

    expect(result.layout.width).toBe(320);
    expect(result.layout.height).toBe(180);
    expect(result.layout.maxWidth).toBe(400);
    expect(result.appearance.image?.source).toBe("https://example.com/hero.png");
    expect(result.appearance.image?.fit).toBe("FIT");
    expect(result.appearance.opacity).toBe(0.85);
  });
});
