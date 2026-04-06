import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FIGMA_PLUGIN_BUILD_TARGET } from "../scripts/plugin-build-config.mjs";

describe("project configuration", () => {
  it("exposes plugin build and release packaging scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8")
    ) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.build).toBe("npm run clean && npm run build:plugin");
    expect(packageJson.scripts?.["prepare:release"]).toBe(
      "npm run build && node scripts/prepare-release.mjs"
    );
  });

  it("bundles plugin code to a Figma-compatible javascript target", () => {
    const buildScript = readFileSync(
      resolve(process.cwd(), "scripts/build-plugin.mjs"),
      "utf8"
    );

    expect(FIGMA_PLUGIN_BUILD_TARGET).toBe("es2017");
    expect(buildScript).toContain('./plugin-build-config.mjs');
  });

  it("includes deployment-critical manifest fields", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "manifest.json"), "utf8")
    ) as {
      documentAccess?: string;
      networkAccess?: {
        allowedDomains?: string[];
        reasoning?: string;
      };
      editorType?: string[];
    };

    expect(manifest.documentAccess).toBe("dynamic-page");
    expect(manifest.editorType).toEqual(["figma"]);
    expect(manifest.networkAccess?.allowedDomains).toEqual(["*"]);
    expect(manifest.networkAccess?.reasoning).toMatch(/image assets/i);
  });
});
