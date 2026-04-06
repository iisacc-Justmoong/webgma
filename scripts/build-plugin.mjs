import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { build } from "esbuild";
import { getPluginBuildConfig } from "./plugin-build-config.mjs";

const rootDirectory = process.cwd();
const outputCodePath = resolve(rootDirectory, "build/plugin/code.js");
const outputUiPath = resolve(rootDirectory, "build/plugin/ui.html");
const { uiHtml, buildOptions } = getPluginBuildConfig(
  rootDirectory,
  outputCodePath
);

mkdirSync(dirname(outputCodePath), { recursive: true });

await build(buildOptions);

writeFileSync(outputUiPath, uiHtml);
