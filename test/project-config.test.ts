import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("project configuration", () => {
  it("does not expose preview build or dev scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8")
    ) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.build).toBe("npm run clean && npm run build:plugin");
    expect(packageJson.scripts).not.toHaveProperty("build:backend");
    expect(packageJson.scripts).not.toHaveProperty("dev:backend");
  });
});
