import { describe, expect, it } from "vitest";
import { createDesignPlan } from "../src/shared/services/design-plan-service.js";

describe("createDesignPlan", () => {
  it("derives starter auto-layout hints from merged inline HTML", () => {
    const designPlan = createDesignPlan(`
      <div style="display:flex;flex-direction:column;gap:16px;padding:24px;background:#ffffff;border-radius:20px;">
        <h1 style="font-size:32px;font-weight:700;color:#0f172a;">Webgma</h1>
        <p style="font-size:16px;line-height:24px;color:rgb(71, 85, 105);">
          Inline HTML becomes the source of truth.
        </p>
      </div>
    `);

    const cardNode = designPlan.root.children[0];

    expect(cardNode.kind).toBe("FRAME");
    expect(cardNode.layout.mode).toBe("VERTICAL");
    expect(cardNode.layout.gap).toBe(16);
    expect(cardNode.layout.padding.top).toBe(24);
    expect(cardNode.appearance.cornerRadius).toBe(20);

    const titleNode = cardNode.children[0];

    expect(titleNode.kind).toBe("TEXT");
    expect(titleNode.textContent).toBe("Webgma");
    expect(titleNode.text?.fontSize).toBe(32);
    expect(titleNode.text?.fontWeight).toBe(700);
  });

  it("keeps text nodes readable when they are inherited from parent styles", () => {
    const designPlan = createDesignPlan(`
      <div style="color:#2563eb;font-size:14px;">
        Welcome to <span style="font-weight:700;">Webgma</span>
      </div>
    `);

    const containerNode = designPlan.root.children[0];
    const firstTextNode = containerNode.children[0];
    const emphasizedNode = containerNode.children[1];

    expect(firstTextNode.kind).toBe("TEXT");
    expect(firstTextNode.text?.fontSize).toBe(14);
    expect(emphasizedNode.kind).toBe("TEXT");
    expect(emphasizedNode.text?.fontWeight).toBe(700);
  });

  it("flattens inline text fragments into a single text node", () => {
    const designPlan = createDesignPlan(`
      <p>Hello <strong>world</strong></p>
    `);

    const paragraphNode = designPlan.root.children[0];

    expect(paragraphNode.kind).toBe("TEXT");
    expect(paragraphNode.textContent).toBe("Hello world");
    expect(paragraphNode.text?.segments).toHaveLength(2);
    expect(paragraphNode.text?.segments[1].fontWeight).toBe(700);
  });

  it("keeps single-child wrappers in auto layout so they hug content", () => {
    const designPlan = createDesignPlan(`
      <div style="padding:16px;">
        <h1 style="font-size:24px;">Title</h1>
      </div>
    `);

    const wrapperNode = designPlan.root.children[0];

    expect(wrapperNode.kind).toBe("FRAME");
    expect(wrapperNode.layout.mode).toBe("VERTICAL");
    expect(wrapperNode.layout.padding.top).toBe(16);
    expect(wrapperNode.children).toHaveLength(1);
  });

  it("preserves image nodes and background images in the design plan", () => {
    const designPlan = createDesignPlan(`
      <section style="background-image:url('https://example.com/hero.png'); width:320px; height:180px;">
        <img src="https://example.com/avatar.png" width="64" height="64" alt="Avatar" />
      </section>
    `);

    const sectionNode = designPlan.root.children[0];
    const imageNode = sectionNode.children[0];

    expect(sectionNode.appearance.image?.source).toBe("https://example.com/hero.png");
    expect(imageNode.kind).toBe("IMAGE");
    expect(imageNode.appearance.image?.source).toBe("https://example.com/avatar.png");
    expect(imageNode.layout.width).toBe(64);
    expect(imageNode.layout.height).toBe(64);
  });

  it("derives borders and shadows so frames do not render as empty boxes", () => {
    const designPlan = createDesignPlan(`
      <div style="background:white;border:2px solid #cbd5e1;box-shadow:0 12px 24px rgba(15, 23, 42, 0.16);width:280px;height:160px;"></div>
    `);

    const cardNode = designPlan.root.children[0];

    expect(cardNode.appearance.fills[0]).toMatchObject({
      r: 1,
      g: 1,
      b: 1,
      opacity: 1
    });
    expect(cardNode.appearance.strokes).toHaveLength(1);
    expect(cardNode.appearance.strokes[0].weight).toBe(2);
    expect(cardNode.appearance.shadows).toHaveLength(1);
    expect(cardNode.appearance.shadows[0].type).toBe("DROP_SHADOW");
    expect(cardNode.appearance.shadows[0].offsetY).toBe(12);
    expect(cardNode.appearance.shadows[0].blur).toBe(24);
  });

  it("parses hsl and named colors from inline styles", () => {
    const designPlan = createDesignPlan(`
      <div style="background-color:hsl(221, 83%, 53%);border:1px solid white;"></div>
    `);

    const colorNode = designPlan.root.children[0];

    expect(colorNode.appearance.fills[0].r).toBeCloseTo(0.14, 2);
    expect(colorNode.appearance.fills[0].g).toBeCloseTo(0.39, 2);
    expect(colorNode.appearance.fills[0].b).toBeCloseTo(0.92, 2);
    expect(colorNode.appearance.strokes[0].color).toMatchObject({
      r: 1,
      g: 1,
      b: 1,
      opacity: 1
    });
  });

  it("captures richer box-model hints for flex containers and children", () => {
    const designPlan = createDesignPlan(`
      <section style="display:flex;flex-wrap:wrap;gap:16px 24px;overflow:hidden;width:480px;">
        <article style="margin:8px 12px;flex:1 0 200px;align-self:stretch;"></article>
      </section>
    `);

    const containerNode = designPlan.root.children[0];
    const childNode = containerNode.children[0];

    expect(containerNode.layout.wrap).toBe("WRAP");
    expect(containerNode.layout.gap).toBe(24);
    expect(containerNode.layout.crossGap).toBe(16);
    expect(containerNode.layout.clipsContent).toBe(true);
    expect(childNode.item.margin.top).toBe(8);
    expect(childNode.item.margin.left).toBe(12);
    expect(childNode.item.flexGrow).toBe(1);
    expect(childNode.item.flexShrink).toBe(0);
    expect(childNode.item.flexBasis).toBe(200);
    expect(childNode.item.alignSelf).toBe("STRETCH");
  });

  it("captures absolute placement and z-index ordering hints", () => {
    const designPlan = createDesignPlan(`
      <section style="width:400px;height:300px;position:relative;">
        <div style="position:absolute;top:24px;right:16px;width:100px;height:80px;z-index:3;"></div>
        <div style="position:absolute;left:8px;top:8px;width:40px;height:40px;z-index:1;"></div>
      </section>
    `);

    const containerNode = designPlan.root.children[0];
    const firstChild = containerNode.children[0];
    const secondChild = containerNode.children[1];

    expect(firstChild.item.zIndex).toBe(1);
    expect(secondChild.item.zIndex).toBe(3);
    expect(secondChild.item.position).toBe("ABSOLUTE");
    expect(secondChild.item.inset.top).toBe(24);
    expect(secondChild.item.inset.right).toBe(16);
  });
});
