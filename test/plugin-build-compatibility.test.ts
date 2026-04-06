import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getPluginBuildConfig } from "../scripts/plugin-build-config.mjs";

describe("plugin build compatibility", () => {
  it("emits bundle syntax that Figma can parse", async () => {
    const rootDirectory = process.cwd();
    const temporaryDirectory = mkdtempSync(
      join(tmpdir(), "webgma-plugin-build-")
    );
    const outputCodePath = resolve(temporaryDirectory, "code.js");

    try {
      const { buildOptions } = getPluginBuildConfig(
        rootDirectory,
        outputCodePath
      );

      await build(buildOptions);

      const bundleCode = readFileSync(outputCodePath, "utf8");
      const sourceFile = ts.createSourceFile(
        "plugin-bundle.js",
        bundleCode,
        ts.ScriptTarget.Latest,
        false,
        ts.ScriptKind.JS
      );
      const unsupportedTokens: string[] = [];

      const visitNode = (node: ts.Node) => {
        if (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
          unsupportedTokens.push("??");
        }
        if (
          ts.isPropertyAccessChain(node) ||
          ts.isElementAccessChain(node) ||
          ts.isCallChain(node)
        ) {
          unsupportedTokens.push("?.");
        }
        if (ts.isSpreadAssignment(node)) {
          unsupportedTokens.push("{...}");
        }

        ts.forEachChild(node, visitNode);
      };

      visitNode(sourceFile);

      expect(unsupportedTokens).toEqual([]);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
