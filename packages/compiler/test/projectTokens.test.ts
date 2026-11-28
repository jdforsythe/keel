// @vitest-environment happy-dom
// projectTokens (k.looks Shipped tokens, k.a11y-static Tokens): the one evaluation of a project's `tokens.ts`, used by
// `keel check`, `keel build`, `keel test`'s setup and the evidence. It runs under any loader (this file runs it inside
// the test runner's, in a DOM environment, as `keel test`'s setup does in a linked workspace), never runs an installed
// library's tokens file, and never judges a stale token in a long-lived process.
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@keel/tooling/repo-root";
import { testTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, describe, expect, it } from "vitest";
import { projectTokens } from "../src/hosting/projectTokens.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const project = (files: Readonly<Record<string, string>>): string => {
  const dir = tempDir(".tmp-project-tokens-", import.meta.dirname);
  dirs.push(dir);
  // The project has `@keel/ui` installed, as an app does: the evaluation resolves it from the project root.
  mkdirSync(join(dir, "node_modules", "@keel"), { recursive: true });
  symlinkSync(join(repoRoot(import.meta.dirname), "packages", "ui"), join(dir, "node_modules", "@keel", "ui"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
};

/** An installed library `@acme/kit` (module id `kit`) whose `./tokens` names a `.ts` file under `node_modules`. */
const installedKit = (kitSource: string): Readonly<Record<string, string>> => ({
  "modules/app/module.ts": "export default { id: 'app', deps: ['@acme/kit'], capabilities: [] };\n",
  "node_modules/@acme/kit/package.json": JSON.stringify({
    name: "@acme/kit",
    version: "1.0.0",
    type: "module",
    keel: "library",
    exports: { "./tokens": { keel: "./src/kitTokens.ts", default: "./dist/src/kitTokens.js" } },
  }),
  "node_modules/@acme/kit/module.ts": "export default { id: 'kit', deps: [], capabilities: [] };\n",
  "node_modules/@acme/kit/src/kitTokens.ts": kitSource,
  "tokens.ts":
    'import { kitTokens } from "@acme/kit/tokens";\nexport const tokens = { color: { fg: "#111111", ...kitTokens.color } };\n',
});

describe("projectTokens", () => {
  it("is undefined without tokens.ts, and gives the reason for one that throws", async () => {
    expect(await projectTokens(project({}))).toBeUndefined();
    expect(await projectTokens(project({ "tokens.ts": 'throw new Error("broken");\n' }))).toEqual({
      ok: false,
      reason: "tokens.ts throws: broken",
    });
  });

  it(
    "composes an installed library's shipped tokens from the literal; the library's file never runs",
    async () => {
      const kit = [
        'import { defineTokens } from "@keel/ui/tokens";',
        'export const kitTokens = defineTokens({ color: { "kit.accent": { light: "#0b5cad", dark: "#8ab8f0" } } });',
        'throw new Error("the shipped tokens file ran");',
        "",
      ].join("\n");
      const r = await projectTokens(project(installedKit(kit)));
      expect(r).toMatchObject({
        ok: true,
        tokens: { color: { fg: "#111111", "kit.accent": { light: "#0b5cad", dark: "#8ab8f0" } } },
      });
    },
    testTime(20_000),
  );

  it(
    "a tokens.ts changed in the same process gives the new tokens",
    async () => {
      const dir = project({ "tokens.ts": 'export const tokens = { color: { fg: "#111111" } };\n' });
      expect(await projectTokens(dir)).toMatchObject({ ok: true, tokens: { color: { fg: "#111111" } } });
      writeFileSync(join(dir, "tokens.ts"), 'export const tokens = { color: { fg: "#222222" } };\n');
      expect(await projectTokens(dir)).toMatchObject({ ok: true, tokens: { color: { fg: "#222222" } } });
    },
    testTime(20_000),
  );
});
