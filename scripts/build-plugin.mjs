import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { build } from "esbuild";

const rootDirectory = process.cwd();
const pluginEntry = resolve(rootDirectory, "src/plugin/code.ts");
const uiSourcePath = resolve(rootDirectory, "src/plugin/ui.html");
const outputCodePath = resolve(rootDirectory, "build/plugin/code.js");
const outputUiPath = resolve(rootDirectory, "build/plugin/ui.html");
const uiHtml = readFileSync(uiSourcePath, "utf8");

mkdirSync(dirname(outputCodePath), { recursive: true });

await build({
  entryPoints: [pluginEntry],
  bundle: true,
  outfile: outputCodePath,
  format: "iife",
  platform: "browser",
  target: "es2020",
  define: {
    __PLUGIN_UI_HTML__: JSON.stringify(uiHtml)
  }
});

writeFileSync(outputUiPath, uiHtml);
