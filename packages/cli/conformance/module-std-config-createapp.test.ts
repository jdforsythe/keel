// Spec: k.module, clause "`stdConfig` returns, for the `ctx` given to `createApp({ std })`, every module's config, equal to its manifest literal, and `{}` for another ctx; a `std.json` failing a registered schema rejects with E1158 naming the path, a hand-edited one with E1160."
// Seed 1337
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "@keel/cli";
import { stdConfig } from "@keel/compiler/std/stdConfig";
import { createCtx } from "@keel/ctx";
import { manifest as routeManifest } from "@keel/router";
import { s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PKG = "@keel/std-cfgapp";
const LATE = "@keel/std-cfglate";
const Config = s.object({ limit: s.int({ min: 1, max: 100 }), tags: s.array(s.string({ max: 8 })) });
s.register(PKG, Config);

let tmp = "";
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-std-cfg-"));
  for (const name of ["std-cfgapp", "std-cfglate"]) {
    const dir = path.join(tmp, "node_modules/@keel", name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: `@keel/${name}`, type: "module", exports: "./index.js" }),
    );
    fs.writeFileSync(path.join(dir, "index.js"), "export {};\n");
  }
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const manifestSrc = (id: string, pkg: string, config: unknown): string =>
  `import { module } from '@keel/compiler'\nexport default module(${JSON.stringify({
    id,
    deps: [pkg],
    capabilities: [],
    public: { exports: [], routes: [] },
    std: { [pkg]: config },
  })})\n`;

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Builds the modules with the real CLI and returns the text of `.keel/std.json`. */
const buildStd = async (pkg: string, mods: { id: string; config: unknown }[]): Promise<string> => {
  let text = "";
  const r = await run(["build", "--format=json"], {
    cwd: tmp,
    files: mods.map((m) => ({ path: `modules/${m.id}/module.ts`, source: manifestSrc(m.id, pkg, m.config) })),
    env: { KEEL_AGENT: "1" },
    apply: (w) => {
      for (const x of w) if (x.path === ".keel/std.json" && x.content !== null) text = x.content;
    },
  });
  expect(r.code).toBe(0);
  expect(text).not.toBe("");
  return text;
};

let n = 0;
const fileOf = (text: string): string => {
  const f = path.join(tmp, `std-${n++}.json`);
  fs.writeFileSync(f, text);
  return f;
};

const app = (ctx: ReturnType<typeof createCtx>, std: string) =>
  createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: routeManifest({ "app.home": { path: "/", component: () => document.createElement("main") } }),
    ctx,
    mode: "dev",
    std,
  });
const mkCtx = () => createCtx({ mode: "sim", seed: 1337 });

const validConfig = fc.record({
  limit: fc.integer({ min: 1, max: 100 }),
  tags: fc.array(fc.string({ maxLength: 8 }), { maxLength: 4 }),
});
const moduleIds = fc.uniqueArray(fc.constantFrom("alpha", "beta", "gamma", "delta"), { minLength: 1, maxLength: 3 });

describe("k.module: stdConfig and createApp({ std })", () => {
  it("`stdConfig` returns, for the `ctx` given to `createApp({ std })`, every module's config, equal to its manifest literal, and `{}` for another ctx", async () => {
    // seed 1337
    await fc.assert(
      fc.asyncProperty(moduleIds, fc.array(validConfig, { minLength: 3, maxLength: 3 }), async (ids, cfgs) => {
        const mods = ids.map((id, i) => ({ id, config: cfgs[i] }));
        const file = fileOf(await buildStd(PKG, mods));
        const ctx = mkCtx();
        await app(ctx, file);
        const expected: Record<string, unknown> = {};
        for (const m of mods) expected[m.id] = m.config;
        expect(stdConfig(ctx, PKG, Config)).toEqual(expected);
        expect(stdConfig(mkCtx(), PKG, Config)).toEqual({});
      }),
      { seed: 1337, numRuns: 15 },
    );
  }, 120_000);

  it("a `std.json` failing a registered schema rejects with E1158 naming the path", async () => {
    // Built while LATE has no schema (the build keeps the value); a stricter schema is registered afterwards.
    const file = fileOf(await buildStd(LATE, [{ id: "alpha", config: { limit: 5, tags: [] } }]));
    s.register(LATE, s.object({ limit: s.int({ min: 10, max: 100 }), tags: s.array(s.string()) }));
    await expect(app(mkCtx(), file)).rejects.toMatchObject({
      code: "E1158",
      message: expect.stringContaining("limit"),
    });
  }, 120_000);

  it("a hand-edited `std.json` rejects with E1160", async () => {
    // seed 1337
    await fc.assert(
      fc.asyncProperty(validConfig, fc.integer({ min: 1, max: 100 }), async (config, other) => {
        const text = await buildStd(PKG, [{ id: "alpha", config }]);
        const doc: unknown = JSON.parse(text);
        if (!isRec(doc) || !isRec(doc.data)) throw new Error("std.json is not { data, hash }");
        const edited = JSON.stringify({
          data: { [PKG]: { alpha: { ...config, limit: config.limit === other ? other + 101 : other } } },
          hash: doc.hash,
        });
        await expect(app(mkCtx(), fileOf(edited))).rejects.toMatchObject({ code: "E1160" });
      }),
      { seed: 1337, numRuns: 15 },
    );
  }, 120_000);

  it("a missing or non-JSON `std` file rejects with E1160", async () => {
    await expect(app(mkCtx(), path.join(tmp, "absent.json"))).rejects.toMatchObject({ code: "E1160" });
    await expect(app(mkCtx(), fileOf("not json {"))).rejects.toMatchObject({ code: "E1160" });
    await expect(app(mkCtx(), fileOf('{"data":{}}'))).rejects.toMatchObject({ code: "E1160" });
  });
});
