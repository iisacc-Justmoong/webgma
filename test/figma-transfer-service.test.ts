import { describe, expect, it } from "vitest";
import type { DesignPlanDocument } from "../src/shared/contracts.js";
import { createFigmaTransferDocument } from "../src/shared/services/figma-transfer-service.js";

describe("figma-transfer-service", () => {
  it("sanitizes unsafe layout and text values into a Figma-safe transfer document", () => {
    const designPlan: DesignPlanDocument = {
      version: 1,
      metadata: {
        generatedAt: "2026-04-06T00:00:00.000Z",
        source: "inline-html"
      },
      root: {
        id: "root",
        kind: "FRAME",
        name: "  Root  ",
        tagName: "body",
        textContent: undefined,
        styles: {},
        layout: {
          mode: "NONE",
          gap: 40,
          crossGap: 12,
          wrap: "WRAP",
          padding: {
            top: -10,
            right: 20,
            bottom: 30,
            left: 40
          },
          minWidth: 500,
          maxWidth: 320,
          clipsContent: true,
          justifyContent: "SPACE_BETWEEN",
          alignItems: "STRETCH"
        },
        item: {
          margin: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
          },
          alignSelf: "AUTO",
          flexGrow: 0,
          flexShrink: 1,
          position: "AUTO",
          inset: {},
          zIndex: undefined
        },
        appearance: {
          fills: [],
          shadows: [],
          strokes: [],
          opacity: 1
        },
        text: undefined,
        children: [
          {
            id: "root.0",
            kind: "TEXT",
            name: "",
            tagName: "p",
            textContent: "Hello",
            styles: {},
            layout: {
              mode: "NONE",
              gap: 0,
              crossGap: 0,
              wrap: "NO_WRAP",
              padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
              },
              width: 240,
              maxWidth: 180,
              minWidth: 320,
              clipsContent: false,
              justifyContent: "FLEX_START",
              alignItems: "FLEX_START"
            },
            item: {
              margin: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
              },
              alignSelf: "AUTO",
              flexGrow: -2,
              flexShrink: -1,
              flexBasis: -100,
              position: "AUTO",
              inset: {
                left: -16
              },
              zIndex: 2.3
            },
            appearance: {
              fills: [
                {
                  r: 1.5,
                  g: -0.2,
                  b: 0.4,
                  opacity: 1.5
                }
              ],
              shadows: [],
              strokes: [],
              opacity: 2
            },
            text: {
              fontSize: 18,
              fontStyle: "ITALIC",
              fontWeight: 700,
              lineHeight: 24,
              letterSpacing: 0.2,
              textAlign: "CENTER",
              segments: [
                {
                  start: -10,
                  end: 99,
                  fills: [
                    {
                      r: 2,
                      g: -1,
                      b: 0.4,
                      opacity: 2
                    }
                  ],
                  fontStyle: "ITALIC",
                  fontWeight: 700
                }
              ]
            },
            children: [
              {
                id: "root.0.0",
                kind: "FRAME",
                name: "Dropped",
                tagName: "span",
                textContent: undefined,
                styles: {},
                layout: {
                  mode: "NONE",
                  gap: 0,
                  crossGap: 0,
                  wrap: "NO_WRAP",
                  padding: {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0
                  },
                  clipsContent: false,
                  justifyContent: "FLEX_START",
                  alignItems: "FLEX_START"
                },
                item: {
                  margin: {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0
                  },
                  alignSelf: "AUTO",
                  flexGrow: 0,
                  flexShrink: 1,
                  position: "AUTO",
                  inset: {},
                  zIndex: undefined
                },
                appearance: {
                  fills: [],
                  shadows: [],
                  strokes: []
                },
                text: undefined,
                children: []
              }
            ]
          }
        ]
      }
    };

    const result = createFigmaTransferDocument(designPlan);

    expect(result.metadata.handoff).toBe("figma-safe");
    expect(result.root.layout.mode).toBe("NONE");
    expect(result.root.layout.gap).toBe(0);
    expect(result.root.layout.wrap).toBe("NO_WRAP");
    expect(result.root.layout.padding.top).toBe(0);
    expect(result.root.layout.minWidth).toBe(500);
    expect(result.root.layout.maxWidth).toBe(500);

    const textNode = result.root.children[0];

    expect(textNode.name).toBe("Text");
    expect(textNode.layout.minWidth).toBe(320);
    expect(textNode.layout.maxWidth).toBe(320);
    expect(textNode.item.flexGrow).toBe(0);
    expect(textNode.item.flexShrink).toBe(0);
    expect(textNode.item.flexBasis).toBe(0);
    expect(textNode.item.inset.left).toBe(-16);
    expect(textNode.item.zIndex).toBe(2);
    expect(textNode.appearance.fills[0]).toMatchObject({
      r: 1,
      g: 0,
      b: 0.4,
      opacity: 1
    });
    expect(textNode.appearance.opacity).toBe(1);
    expect(textNode.text?.segments).toEqual([
      {
        start: 0,
        end: 5,
        fills: [
          {
            r: 1,
            g: 0,
            b: 0.4,
            opacity: 1
          }
        ],
        fontSize: undefined,
        fontStyle: "ITALIC",
        fontWeight: 700,
        letterSpacing: undefined,
        lineHeight: undefined
      }
    ]);
    expect(textNode.children).toHaveLength(0);
    expect(result.warnings).toContain(
      "Invalid min/max range was normalized during Figma transfer: root.layout.width."
    );
    expect(result.warnings).toContain(
      "Invalid text segments were normalized during Figma transfer: root.0."
    );
    expect(result.warnings).toContain(
      "Non-frame node children were dropped during Figma transfer sanitization: root.0."
    );
  });

  it("drops unsupported image sources from the Figma transfer payload", () => {
    const designPlan: DesignPlanDocument = {
      version: 1,
      metadata: {
        generatedAt: "2026-04-06T00:00:00.000Z",
        source: "inline-html"
      },
      root: {
        id: "root",
        kind: "IMAGE",
        name: "Hero",
        tagName: "img",
        textContent: undefined,
        styles: {},
        layout: {
          mode: "NONE",
          gap: 0,
          crossGap: 0,
          wrap: "NO_WRAP",
          padding: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
          },
          width: 320,
          height: 180,
          clipsContent: true,
          justifyContent: "FLEX_START",
          alignItems: "FLEX_START"
        },
        item: {
          margin: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
          },
          alignSelf: "AUTO",
          flexGrow: 0,
          flexShrink: 1,
          position: "AUTO",
          inset: {},
          zIndex: undefined
        },
        appearance: {
          fills: [],
          image: {
            fit: "FILL",
            source: "/assets/hero.png",
            sourceType: "URL"
          },
          shadows: [],
          strokes: []
        },
        text: undefined,
        children: []
      }
    };

    const result = createFigmaTransferDocument(designPlan);

    expect(result.root.appearance.image).toBeUndefined();
    expect(result.warnings).toContain(
      "Unsupported image source was dropped during Figma transfer: root.appearance."
    );
  });
});
