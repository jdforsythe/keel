// k.module Std config (rfc:0066): stdArtifact, readStd, bindStd, stdConfig, importDeps, and the Vite plugin's std.json.
// Seed 1337 (fast-check, recorded in each fc.assert).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stdArtifact } from "@keel/compiler";
import { bindStd } from "@keel/compiler/std/bindStd";
import { importDeps } from "@keel/compiler/std/importDeps";
import { readStd } from "@keel/compiler/std/readStd";
import { stdConfig } from "@keel/compiler/std/stdConfig";
import keel from "@keel/compiler/vite";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { artifactText } from "../src/internal/artifactText.ts";
import { hashOf } from "../src/internal/hashOf.ts";

const SEED = 1337;
const PKG = "@keel/std-cfgunit";
const Config = s.object({ limit: s.int({ min: 1, max: 100 }), tags: s.array(s.string({ max: 8 })) }, { closed: true });
s.register(PKG, Config);

const manifest = (id: string, deps: readonly string[], std?: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({\n  id: '${id}',\n  deps: ${JSON.stringify(deps)},\n  capabilities: [],\n  public: { exports: [] },${std === undefined ? "" : `\n  std: ${std},`}\n})\n`;
const mod = (id: string, deps: readonly string[], std?: string) => ({
  path: `modules/${id}/module.ts`,
  source: manifest(id, deps, std),
});

const config = fc.record({
  limit: fc.integer({ min: 1, max: 100 }),
  tags: fc.array(fc.string({ maxLength: 8 }), { maxLength: 3 }),
});
const ids = fc.uniqueArray(fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/), { minLength: 1, maxLength: 3 });

describe("stdArtifact", () => {
  it("collects each module's literal config by package and module id; the hash is the data's", () => {
    fc.assert(
      fc.property(ids, fc.array(config, { minLength: 3, maxLength: 3 }), (names, cfgs) => {
        const files = names.map((id, i) => mod(id, [PKG], `{ '${PKG}': ${JSON.stringify(cfgs[i])} }`));
        const r = stdArtifact([...files].reverse());
        expect(r.diagnostics).toEqual([]);
        expect(r.data).toEqual({ [PKG]: Object.fromEntries(names.map((id, i) => [id, cfgs[i]])) });
        expect(r.hash).toBe(hashOf(r.data));
        expect(readStd(artifactText(r.data))).toEqual(r.data);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });

  it("is {} with no app manifest, an opaque one, or one without std; other files are ignored", () => {
    expect(stdArtifact([]).data).toEqual({});
    const opaque = { path: "modules/a/module.ts", source: "export default module(make())\n" };
    const spread = {
      path: "modules/b/module.ts",
      source: `export default module({ deps: ['${PKG}'], std: { ...x } })\n`,
    };
    const elsewhere = { path: "lib/modules/c/module.ts", source: manifest("c", [PKG], `{ '${PKG}': {} }`) };
    const r = stdArtifact([
      opaque,
      spread,
      elsewhere,
      mod("d", [PKG]),
      { path: "x.ts", source: "export const x = 1\n" },
    ]);
    expect(r).toEqual({ data: {}, hash: hashOf({}), diagnostics: [] });
  });

  it("E1158 for a key not a stdlib package in deps, a non-literal value, and a schema failure naming the path", () => {
    const bad = [
      mod("a", [], `{ '${PKG}': { limit: 1, tags: [] } }`),
      mod("b", ["catalog"], "{ catalog: {} }"),
      mod("c", [PKG], `{ '${PKG}': { limit: n, tags: [] } }`),
      mod("d", [PKG], `{ '${PKG}': { limit: 0, tags: [] } }`),
      mod("e", [PKG], `{ '${PKG}': { limit: 5, tags: ['toolongvalue'] } }`),
    ];
    const r = stdArtifact(bad);
    expect(r.data).toEqual({});
    expect(r.diagnostics.map((d) => [d.code, d.path, d.message])).toEqual([
      ["E1158", "modules/a/module.ts", `std key ${PKG} is not a stdlib package in deps of module a`],
      ["E1158", "modules/b/module.ts", "std key catalog is not a stdlib package in deps of module b"],
      ["E1158", "modules/c/module.ts", `std config for ${PKG} in module c is not literal JSON`],
      ["E1158", "modules/d/module.ts", `std config for ${PKG} fails its schema at limit (min)`],
      ["E1158", "modules/e/module.ts", `std config for ${PKG} fails its schema at tags.0 (max)`],
    ]);
    const at = r.diagnostics[0];
    expect([at?.line, at?.col, at?.see]).toEqual([7, 10, "k.module"]);
  });

  it("reads literal JSON forms: negative numbers, templates, null, booleans, nested arrays; keeps an unregistered package's value", () => {
    const value = "{ a: -1.5, b: `t`, c: null, d: [true, false, [1]], 'e-f': { g: 'h' } }";
    const r = stdArtifact([mod("m", ["@keel/std-free"], `{ '@keel/std-free': ${value} }`)]);
    expect(r.data).toEqual({
      "@keel/std-free": { m: { a: -1.5, b: "t", c: null, d: [true, false, [1]], "e-f": { g: "h" } } },
    });
    for (const v of ["`a${b}`", "+1", "[...x]", "{ [k]: 1 }", "{ m() {} }", "/re/", "1n", "Infinity", "-x", "[,1]"])
      expect(stdArtifact([mod("m", ["@keel/std-free"], `{ '@keel/std-free': ${v} }`)]).diagnostics).toHaveLength(1);
  });
});

describe("non-finite and negative-zero literals (backlog 0195)", () => {
  it("-1e999 and 1e999 are not literal JSON (E1158); -0 is stored as std.json holds it, 0", () => {
    for (const v of ["-1e999", "1e999", "{ n: -1e999 }", "[-1e999]"])
      expect(
        stdArtifact([mod("m", ["@keel/std-free"], `{ '@keel/std-free': ${v} }`)]).diagnostics.map((d) => d.message),
      ).toEqual(["std config for @keel/std-free in module m is not literal JSON"]);
    const r = stdArtifact([mod("m", ["@keel/std-free"], "{ '@keel/std-free': { n: -0, m: -2.5 } }")]);
    expect(r.data).toEqual({ "@keel/std-free": { m: { n: 0, m: -2.5 } } });
    expect(r.data).not.toEqual({ "@keel/std-free": { m: { n: -0, m: -2.5 } } });
    expect(readStd(artifactText(r.data))).toEqual(r.data);
  });
});

describe("readStd", () => {
  it("is undefined for non-JSON, a missing data key, a wrong shape, or a hash that is not its data's", () => {
    fc.assert(
      fc.property(config, fc.stringMatching(/^[a-z]{1,6}$/), (cfg, id) => {
        const data = { [PKG]: { [id]: cfg } };
        const text = artifactText(data);
        expect(readStd(text)).toEqual(data);
        const edited = { data: { [PKG]: { [id]: { ...cfg, limit: cfg.limit + 1 } } }, hash: hashOf(data) };
        expect(readStd(JSON.stringify(edited))).toBeUndefined();
      }),
      { seed: SEED, numRuns: 40 },
    );
    expect(readStd("{")).toBeUndefined();
    expect(readStd("null")).toBeUndefined();
    expect(readStd(JSON.stringify({ hash: "x" }))).toBeUndefined();
    expect(readStd(JSON.stringify({ data: { a: 1 }, hash: hashOf({ a: 1 }) }))).toBeUndefined();
  });
});

describe("bindStd and stdConfig", () => {
  it("round-trips valid configs for the bound ctx; another ctx and an unconfigured package read {}", () => {
    fc.assert(
      fc.property(ids, config, (names, cfg) => {
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const data = { [PKG]: Object.fromEntries(names.map((id) => [id, cfg])) };
        bindStd(ctx, data);
        const got = stdConfig(ctx, PKG, Config);
        expect(got).toEqual(data[PKG]);
        expect(Object.isFrozen(got)).toBe(true);
        expect(stdConfig(createCtx({ mode: "sim", seed: SEED }), PKG, Config)).toEqual({});
        expect(stdConfig(ctx, "@keel/std-other", Config)).toEqual({});
        expect(stdConfig(ctx, "constructor", Config)).toEqual({});
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("bindStd throws E1158 naming the path for a registered package's failing value and binds nothing", () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    expect(() => bindStd(ctx, { [PKG]: { a: { limit: 1, tags: [] }, b: { limit: 1, tags: [3] } } })).toThrow(
      expect.objectContaining({
        code: "E1158",
        message: expect.stringMatching(/^E1158 .* module b .* at tags\.0 \(type\)$/),
      }),
    );
    expect(stdConfig(ctx, PKG, Config)).toEqual({});
  });

  it("stdConfig parses with the caller's schema: an unregistered package's bad value throws E1158 on read", () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    bindStd(ctx, { "@keel/std-late": { m: { limit: "x" } } });
    expect(() => stdConfig(ctx, "@keel/std-late", Config)).toThrow(
      expect.objectContaining({
        code: "E1158",
        message: expect.stringContaining("module m fails its schema at limit"),
      }),
    );
  });
});

describe("importDeps", () => {
  let root = "";
  const pkg = (name: string, body: string, exports: unknown = "./index.js", file = "index.js"): void => {
    const dir = path.join(root, "node_modules", "@keel", name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: `@keel/${name}`, type: "module", exports }),
    );
    fs.writeFileSync(path.join(dir, file), body);
  };
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "keel-deps-"));
    pkg("std-ok", "globalThis.__keelStdOk = (globalThis.__keelStdOk ?? 0) + 1;\nexport {};\n");
    pkg("std-boom", "throw new Error('boom');\n");
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("imports each stdlib dep once, ignores app module ids, and reports E1159 at the deps entry for the rest", async () => {
    const files = [
      mod("a", ["catalog", "@keel/std-ok", "@keel/std-missing"]),
      mod("b", ["@keel/std-ok", "@keel/std-boom"]),
      { path: "modules/c/module.ts", source: "export default module(x)\n" },
      { path: "src/a.ts", source: "export const deps = ['@keel/std-missing']\n" },
    ];
    const diags = await importDeps(root, files);
    expect(Reflect.get(globalThis, "__keelStdOk")).toBe(1);
    expect(diags).toEqual([
      {
        code: "E1159",
        path: "modules/a/module.ts",
        line: 4,
        col: 35,
        message: "stdlib dep @keel/std-missing of module a cannot be imported (not found)",
        see: "k.module",
      },
      {
        code: "E1159",
        path: "modules/b/module.ts",
        line: 4,
        col: 25,
        message: "stdlib dep @keel/std-boom of module b cannot be imported (throws on import)",
        see: "k.module",
      },
    ]);
    expect(
      await importDeps(root, [{ ...mod("z", ["@keel/std-ok"]), path: path.join(root, "apps/x/modules/z/module.ts") }]),
    ).toEqual([]);
    expect(Reflect.get(globalThis, "__keelStdOk")).toBe(1);
  });
  const at = (r: readonly { code: string; message: string }[]): string[] => r.map((d) => `${d.code} ${d.message}`);

  it("loads a package whose exports has only an import condition, nested or under '.' (backlog 0192)", async () => {
    const mark = "globalThis.__keelEsmOnly = (globalThis.__keelEsmOnly ?? 0) + 1;\nexport {};\n";
    pkg("std-esm", mark, { import: "./main.mjs" }, "main.mjs");
    pkg("std-esm-dot", mark, { ".": { require: "./nope.cjs", node: { import: "./main.mjs" } } }, "main.mjs");
    pkg("std-cjs-only", mark, { require: "./main.cjs" }, "main.cjs");
    const diags = await importDeps(root, [mod("a", ["@keel/std-esm", "@keel/std-esm-dot", "@keel/std-cjs-only"])]);
    expect(at(diags)).toEqual(["E1159 stdlib dep @keel/std-cjs-only of module a cannot be imported (not found)"]);
    expect(Reflect.get(globalThis, "__keelEsmOnly")).toBe(2);
  });

  it("retries a failure on the next call: a package installed after an E1159 then loads (backlog 0193)", async () => {
    const files = [mod("a", ["@keel/std-later"])];
    expect(at(await importDeps(root, files))).toEqual([
      "E1159 stdlib dep @keel/std-later of module a cannot be imported (not found)",
    ]);
    pkg("std-later", "globalThis.__keelLater = (globalThis.__keelLater ?? 0) + 1;\nexport {};\n");
    expect(await importDeps(root, files)).toEqual([]);
    expect(await importDeps(root, files)).toEqual([]);
    expect(Reflect.get(globalThis, "__keelLater")).toBe(1);
  });

  it("imports only @keel/std-[a-z0-9-]+ names, from the manifest's own and ancestor node_modules (backlog 0194)", async () => {
    pkg("std-Upper", "export {};\n");
    const files = [mod("a", ["@keel/std-Upper", "@keel/std-ok/sub", "@keel/std-brands"])];
    expect(at(await importDeps(root, files))).toEqual([
      "E1159 stdlib dep @keel/std-Upper of module a cannot be imported (not @keel/std-[a-z0-9-]+)",
      "E1159 stdlib dep @keel/std-ok/sub of module a cannot be imported (not @keel/std-[a-z0-9-]+)",
      "E1159 stdlib dep @keel/std-brands of module a cannot be imported (not found)",
    ]);
    const nested = { ...mod("b", ["@keel/std-ok"]), path: "apps/x/modules/b/module.ts" };
    expect(await importDeps(root, [nested])).toEqual([]);
  });

  it("also imports the ./tools export when the exports map has one; a throw there is E1159 (rfc:0070)", async () => {
    const dir = (n: string): string => path.join(root, "node_modules", "@keel", n);
    const withTools = (n: string, tools: string): void => {
      pkg(n, "export {};\n", { ".": "./index.js", "./tools": { node: "./tools.js" } });
      fs.writeFileSync(path.join(dir(n), "tools.js"), tools);
    };
    withTools("std-tl", "globalThis.__keelTools = (globalThis.__keelTools ?? 0) + 1;\nexport {};\n");
    withTools("std-tb", "throw new Error('boom');\n");
    pkg("std-nt", "export {};\n", { ".": "./index.js" });
    pkg("std-str", "export {};\n", "./index.js");
    const files = [mod("a", ["@keel/std-tl", "@keel/std-nt", "@keel/std-str", "@keel/std-tb"])];
    expect(at(await importDeps(root, files))).toEqual([
      "E1159 stdlib dep @keel/std-tb of module a cannot be imported (tools throws on import)",
    ]);
    expect(Reflect.get(globalThis, "__keelTools")).toBe(1);
    expect(at(await importDeps(root, files))).toHaveLength(1);
    expect(Reflect.get(globalThis, "__keelTools")).toBe(1);
  });
});

describe("vite plugin std.json", () => {
  let root = "";
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "keel-vite-std-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (rel: string, text: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  const plugin = (command: "build" | "serve") => {
    const p = keel();
    p.configResolved({ root, command });
    return p;
  };

  it("writes std.json at buildStart and again when a manifest changes", async () => {
    write("modules/a/module.ts", manifest("a", ["@keel/std-free"], "{ '@keel/std-free': { n: 1 } }"));
    const p = plugin("serve");
    await p.buildStart.call(undefined);
    const read = (): unknown => JSON.parse(fs.readFileSync(path.join(root, ".keel", "std.json"), "utf8"));
    expect(read()).toMatchObject({ data: { "@keel/std-free": { a: { n: 1 } } } });
    write("modules/a/module.ts", manifest("a", ["@keel/std-free"], "{ '@keel/std-free': { n: 2 } }"));
    p.watchChange(path.join(root, "modules/a/module.ts"), { event: "update" });
    await vi.waitFor(() => expect(read()).toMatchObject({ data: { "@keel/std-free": { a: { n: 2 } } } }));
  });

  it("a changed manifest in dev loads its new deps and warns its E1158 before std.json is rewritten (backlog 0196)", async () => {
    write("modules/a/module.ts", manifest("a", []));
    const warnings: string[] = [];
    const p = plugin("serve");
    await p.buildStart.call({ warn: (m: string) => void warnings.push(m) });
    expect(warnings).toEqual([]);
    const dir = path.join(root, "node_modules/@keel/std-devnew");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module", exports: { import: "./i.js" } }));
    const schema = "s.object({ n: s.int({ min: 1 }) })";
    fs.writeFileSync(
      path.join(dir, "i.js"),
      `const { s } = globalThis.__keelSchema;\ns.register("@keel/std-devnew", ${schema});\nexport {};\n`,
    );
    Reflect.set(globalThis, "__keelSchema", { s });
    write("modules/a/module.ts", manifest("a", ["@keel/std-devnew"], "{ '@keel/std-devnew': { n: 0 } }"));
    p.watchChange(path.join(root, "modules/a/module.ts"), { event: "update" });
    await vi.waitFor(() => expect(warnings).toEqual([expect.stringMatching(/^keel: E1158 .*at n \(min\)$/)]));
    const std: unknown = JSON.parse(fs.readFileSync(path.join(root, ".keel", "std.json"), "utf8"));
    expect(std).toMatchObject({ data: {} });
  });

  it("a bad std entry or dep fails a build and warns in dev", async () => {
    write("modules/a/module.ts", manifest("a", [PKG, "@keel/std-gone"], `{ '${PKG}': { limit: 0, tags: [] } }`));
    await expect(plugin("build").buildStart.call(undefined)).rejects.toThrow(/E1159 .*\nE1158 .*at limit \(min\)/);
    const warnings: string[] = [];
    await plugin("serve").buildStart.call({ warn: (m: string) => void warnings.push(m) });
    expect(warnings.map((w) => w.slice(0, 11))).toEqual(["keel: E1159", "keel: E1159", "keel: E1158"]);
  });
});
