import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, expect, test } from "vitest";
import { cleanBuild } from "../scripts/clean-build.mjs";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test("cleaning removes generated output and preserves source files", async () => {
  await mkdir("build", { recursive: true });
  const root = await mkdtemp(resolve("build", "clean-test-"));
  roots.push(root);
  await mkdir(resolve(root, "build"));
  await writeFile(resolve(root, "build", "old.js"), "generated");
  await writeFile(resolve(root, "source.ts"), "source");
  await cleanBuild(root);
  expect(await readFile(resolve(root, "source.ts"), "utf8")).toBe("source");
  await expect(readFile(resolve(root, "build", "old.js"))).rejects.toThrow();
  await cleanBuild(root);
});
