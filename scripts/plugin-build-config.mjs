import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const FIGMA_PLUGIN_BUILD_TARGET = "es2017";

export function getPluginBuildConfig(rootDirectory, outputCodePath) {
  const pluginEntry = resolve(rootDirectory, "src/plugin/code.ts");
  const uiSourcePath = resolve(rootDirectory, "src/plugin/ui.html");
  const uiHtml = readFileSync(uiSourcePath, "utf8");

  return {
    uiHtml,
    buildOptions: {
      entryPoints: [pluginEntry],
      bundle: true,
      outfile: outputCodePath,
      format: "iife",
      platform: "browser",
      target: FIGMA_PLUGIN_BUILD_TARGET,
      define: {
        __PLUGIN_UI_HTML__: JSON.stringify(uiHtml)
      }
    }
  };
}
