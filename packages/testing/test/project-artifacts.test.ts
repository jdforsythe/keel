// @vitest-environment happy-dom
// k.a11y Artifacts: under `keel test` a render given no `artifacts` takes the project's; given `artifacts`, those alone.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { testTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { Text, defineTokens } from "@keel/ui";
import { afterEach, describe, expect, it } from "vitest";
import { harnessArtifacts } from "../src/internal/harnessArtifacts.ts";
import { loadProjectArtifacts } from "../src/internal/loadProjectArtifacts.ts";
import { loadedArtifacts } from "../src/internal/loadedArtifacts.ts";
import { render } from "../src/render.ts";

const dirs: string[] = [];
const project = (files: Readonly<Record<string, string>>): string => {
  // Inside the package: the test runner loads a module only from within its workspace.
  const dir = tempDir(".tmp-artifacts-", import.meta.dirname);
  dirs.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
};
const env = process.env.KEEL_TEST;
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  loadedArtifacts.current = undefined;
  if (env === undefined) Reflect.deleteProperty(process.env, "KEEL_TEST");
  else process.env.KEEL_TEST = env;
});
const A11Y = JSON.stringify({ data: { t: { name: "text", role: null, tag: "span" }, bad: { name: 5 } }, hash: "x" });
const TOKENS = 'export const tokens = { color: { fg: "#111111", bg: "#ffffff" } };\n';

describe("loadProjectArtifacts", () => {
  it("reads `.keel/a11y.json` and the `tokens` export, each only if present", async () => {
    expect(await loadProjectArtifacts(project({}))).toEqual({ ok: true, artifacts: {} });
    const both = await loadProjectArtifacts(project({ ".keel/a11y.json": A11Y, "tokens.ts": TOKENS }));
    expect(both).toEqual({
      ok: true,
      artifacts: {
        "a11y.json": { t: { name: "text", role: null, tag: "span" } },
        tokens: { color: { fg: "#111111", bg: "#ffffff" } },
      },
    });
    expect(await loadProjectArtifacts(project({ "tokens.ts": TOKENS }))).toMatchObject({
      ok: true,
      artifacts: { tokens: { color: { fg: "#111111" } } },
    });
    expect(await loadProjectArtifacts(project({ ".keel/a11y.json": "not json" }))).toEqual({ ok: true, artifacts: {} });
  });

  it("gives the reason for a `tokens.ts` that throws, exports no `tokens` or fails `TokenSchema`", async () => {
    const reason = async (source: string) => {
      const r = await loadProjectArtifacts(project({ "tokens.ts": source }));
      return r.ok ? undefined : r.reason;
    };
    expect(await reason('throw new Error("broken");\n')).toMatch(/^tokens\.ts failed to evaluate: broken/);
    expect(await reason("export const other = 1;\nexport default { color: {} };\n")).toBe(
      "tokens.ts exports no tokens",
    );
    expect(await reason("export const tokens = { color: 5 };\n")).toMatch(/^tokens\.ts: tokens fail TokenSchema/);
  });

  // k.looks Shipped tokens: an installed library's `./tokens` (its `keel` target a `.ts` file under `node_modules`)
  // reaches `tokens.ts` as the literal's data, as `keel check` and `keel build` give it; the file itself never runs,
  // so a runtime that refuses `.ts` under `node_modules` or a top-level throw there changes nothing.
  it(
    "composes an installed library's shipped tokens from the literal, never running the library's file",
    async () => {
      const dir = project({
        "modules/app/module.ts": "export default { id: 'app', deps: ['@acme/kit'], capabilities: [] };\n",
        "node_modules/@acme/kit/package.json": JSON.stringify({
          name: "@acme/kit",
          version: "1.0.0",
          type: "module",
          keel: "library",
          exports: { "./tokens": { keel: "./src/kitTokens.ts", default: "./dist/src/kitTokens.js" } },
        }),
        "node_modules/@acme/kit/module.ts": "export default { id: 'kit', deps: [], capabilities: [] };\n",
        "node_modules/@acme/kit/src/kitTokens.ts": [
          'import { defineTokens } from "@keel/ui";',
          'export const kitTokens = defineTokens({ color: { "kit.accent": "#0b5cad" } });',
          'throw new Error("the shipped tokens file ran");',
          "",
        ].join("\n"),
        "tokens.ts": [
          'import { kitTokens } from "@acme/kit/tokens";',
          'export const tokens = { color: { fg: "#111111", ...kitTokens.color } };',
          "",
        ].join("\n"),
      });
      expect(await loadProjectArtifacts(dir)).toMatchObject({
        ok: true,
        artifacts: { tokens: { color: { fg: "#111111", "kit.accent": "#0b5cad" } } },
      });
    },
    testTime(20_000),
  );
});

describe("harnessArtifacts", () => {
  const view = Object.assign(() => Text({ id: "t", children: "x" }), { Props: s.object({}) });
  const tokens = defineTokens({ color: { fg: "#111111", bg: "#ffffff" } });

  it("given artifacts are used alone, `{}` included, whatever the project holds", () => {
    process.env.KEEL_TEST = "1";
    loadedArtifacts.current = { ok: true, artifacts: { tokens } };
    expect(harnessArtifacts({})).toEqual({});
    const given = { "a11y.json": {} };
    expect(harnessArtifacts(given)).toBe(given);
  });

  it("with none given, the project's under `KEEL_TEST=1` and none outside it", () => {
    loadedArtifacts.current = { ok: true, artifacts: { tokens } };
    process.env.KEEL_TEST = "1";
    expect(harnessArtifacts(undefined)).toEqual({ tokens });
    Reflect.deleteProperty(process.env, "KEEL_TEST");
    expect(harnessArtifacts(undefined)).toBeUndefined();
    process.env.KEEL_TEST = "1";
    loadedArtifacts.current = undefined;
    expect(harnessArtifacts(undefined)).toBeUndefined();
  });

  it("an unusable `tokens.ts` makes a render given no artifacts throw E1807 naming it, and one given artifacts render", () => {
    process.env.KEEL_TEST = "1";
    loadedArtifacts.current = { ok: false, reason: "tokens.ts exports no tokens" };
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    expect(() => render(view, { props: {}, ctx })).toThrow(/^E1807 tokens\.ts exports no tokens/);
    const h = render(view, { props: {}, ctx, artifacts: {} });
    expect(h.find("t").text).toBe("x");
    h.dispose();
  });
});
