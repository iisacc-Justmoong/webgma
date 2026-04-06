import { describe, expect, it } from "vitest";
import {
  generateDefaultStyleTokenFallbacks,
  implementStyleDeclarations
} from "../src/shared/services/style-implementation-service.js";

describe("style-implementation-service", () => {
  it("generates default fallback values for missing style tokens", () => {
    const fallbacks = generateDefaultStyleTokenFallbacks({
      color: "var(--text-primary)",
      background: "var(--surface-elevated)",
      padding: "var(--space-lg)",
      "border-radius": "var(--radius-pill)",
      "font-size": "var(--font-size-body)",
      "box-shadow": "var(--shadow-card)"
    });

    expect(fallbacks).toEqual(
      new Map([
        ["--text-primary", "#111827"],
        ["--surface-elevated", "#ffffff"],
        ["--space-lg", "16px"],
        ["--radius-pill", "999px"],
        ["--font-size-body", "16px"],
        ["--shadow-card", "0 12px 24px rgba(15, 23, 42, 0.12)"]
      ])
    );
  });

  it("implements styles by resolving generated token fallbacks into concrete declarations", () => {
    const implementation = implementStyleDeclarations({
      color: "var(--text-primary)",
      background: "var(--surface-elevated)",
      padding: "var(--space-lg)",
      "border-radius": "var(--radius-pill)",
      "font-size": "var(--font-size-body)"
    });

    expect(implementation.resolvedStyles).toMatchObject({
      color: "#111827",
      background: "#ffffff",
      padding: "16px",
      "border-radius": "999px",
      "font-size": "16px"
    });
    expect(implementation.customProperties.get("--text-primary")).toBe("#111827");
    expect(implementation.warnings).toContain(
      "Generated default fallback for missing CSS token --text-primary: #111827."
    );
    expect(implementation.warnings).toContain(
      "Generated default fallback for missing CSS token --space-lg: 16px."
    );
  });

  it("prefers explicit custom properties and explicit var fallbacks over generated defaults", () => {
    const implementation = implementStyleDeclarations(
      {
        "--brand-primary": "#ff0066",
        color: "var(--brand-primary)",
        padding: "var(--space-md, 12px)"
      },
      new Map([
        ["--text-primary", "#0f172a"]
      ])
    );

    expect(implementation.resolvedStyles).toMatchObject({
      color: "#ff0066",
      padding: "12px"
    });
    expect(implementation.generatedFallbacks.has("--brand-primary")).toBe(false);
    expect(implementation.generatedFallbacks.has("--space-md")).toBe(false);
  });
});
