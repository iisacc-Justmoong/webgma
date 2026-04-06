import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const UI_CANDIDATE_PATHS = [
  resolve(process.cwd(), "src/plugin/ui.html"),
  resolve(process.cwd(), "build/plugin/ui.html")
];

export function loadPluginUiPreviewHtml(): string {
  for (const candidatePath of UI_CANDIDATE_PATHS) {
    if (existsSync(candidatePath)) {
      return readFileSync(candidatePath, "utf8");
    }
  }

  throw new Error("Plugin UI preview HTML could not be found.");
}
