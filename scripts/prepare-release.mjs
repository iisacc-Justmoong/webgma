import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function createReleaseManifest(manifest) {
  return {
    ...manifest,
    main: "plugin/code.js",
    ui: "plugin/ui.html"
  };
}

export function prepareReleaseArtifacts(rootDirectory = process.cwd()) {
  const buildPluginDirectory = resolve(rootDirectory, "build/plugin");
  const buildCodePath = resolve(buildPluginDirectory, "code.js");
  const buildUiPath = resolve(buildPluginDirectory, "ui.html");
  const rootManifestPath = resolve(rootDirectory, "manifest.json");
  const releaseDirectory = resolve(rootDirectory, "build/release");
  const releasePluginDirectory = resolve(releaseDirectory, "plugin");
  const publishingGuidePath = resolve(rootDirectory, "docs/publishing.md");

  if (!existsSync(buildCodePath) || !existsSync(buildUiPath)) {
    throw new Error(
      "Release artifacts are missing. Run `npm run build` before preparing a release."
    );
  }

  rmSync(releaseDirectory, { force: true, recursive: true });
  mkdirSync(releasePluginDirectory, { recursive: true });
  cpSync(buildPluginDirectory, releasePluginDirectory, { recursive: true });

  const manifest = JSON.parse(readFileSync(rootManifestPath, "utf8"));
  const releaseManifest = createReleaseManifest(manifest);

  writeFileSync(
    resolve(releaseDirectory, "manifest.json"),
    `${JSON.stringify(releaseManifest, null, 2)}\n`
  );
  copyFileSync(publishingGuidePath, resolve(releaseDirectory, "PUBLISHING.md"));
}

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  prepareReleaseArtifacts();
}
