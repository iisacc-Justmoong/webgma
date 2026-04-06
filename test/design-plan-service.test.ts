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
});
