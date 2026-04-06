import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createReleaseManifest,
  prepareReleaseArtifacts
} from "../scripts/prepare-release.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop(), { force: true, recursive: true });
  }
});

describe("prepare-release script", () => {
  it("rewrites manifest asset paths for release packaging", () => {
    const releaseManifest = createReleaseManifest({
      name: "Webgma",
      main: "build/plugin/code.js",
      ui: "build/plugin/ui.html"
    });

    expect(releaseManifest.main).toBe("plugin/code.js");
    expect(releaseManifest.ui).toBe("plugin/ui.html");
  });

  it("creates a release folder with packaged assets and publishing guide", () => {
    const rootDirectory = mkdtempSync(join(tmpdir(), "webgma-release-"));

    temporaryDirectories.push(rootDirectory);
    mkdirSync(resolve(rootDirectory, "build/plugin"), { recursive: true });
    mkdirSync(resolve(rootDirectory, "docs"), { recursive: true });

    writeFileSync(
      resolve(rootDirectory, "manifest.json"),
      JSON.stringify(
        {
          name: "Webgma",
          main: "build/plugin/code.js",
          ui: "build/plugin/ui.html",
          editorType: ["figma"]
        },
        null,
        2
      )
    );
    writeFileSync(resolve(rootDirectory, "build/plugin/code.js"), "code");
    writeFileSync(resolve(rootDirectory, "build/plugin/ui.html"), "ui");
    writeFileSync(resolve(rootDirectory, "docs/publishing.md"), "# Publish");

    prepareReleaseArtifacts(rootDirectory);

    const packagedManifest = JSON.parse(
      readFileSync(resolve(rootDirectory, "build/release/manifest.json"), "utf8")
    ) as {
      main: string;
      ui: string;
    };

    expect(packagedManifest.main).toBe("plugin/code.js");
    expect(packagedManifest.ui).toBe("plugin/ui.html");
    expect(
      readFileSync(resolve(rootDirectory, "build/release/plugin/code.js"), "utf8")
    ).toBe("code");
    expect(
      readFileSync(resolve(rootDirectory, "build/release/PUBLISHING.md"), "utf8")
    ).toContain("# Publish");
  });
});
