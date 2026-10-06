import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function cleanBuild(rootDirectory) {
  await rm(resolve(rootDirectory, "build"), { recursive: true, force: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await cleanBuild(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
}
