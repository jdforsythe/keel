// Backlog 0189 (rfc:0069): the browser binds std config. bindClientStd reads `#k-state`'s `std`; the resume entry calls
// it before `resume`; a `client` deployable's entry embeds std.json's data. Seed 1337 (fast-check, in each fc.assert).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bindClientStd } from "@keel/compiler/std/bindClientStd";
import { clientStd } from "@keel/compiler/std/clientStd";
import { clientStdData } from "@keel/compiler/std/clientStdData";
import { stdConfig } from "@keel/compiler/std/stdConfig";
import keel from "@keel/compiler/vite";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import fc from "fast-check";
import { parseSync } from "oxc-parser";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ENTRY_PATH } from "../src/entry/ENTRY_PATH.ts";
import { RESUME_ENTRY } from "../src/entry/RESUME_ENTRY.ts";
import { entryCode } from "../src/internal/entryCode.ts";

const SEED = 1337;
const PKG = "@keel/std-cfgclientunit";
const Config = s.object({ limit: s.int({ min: 1, max: 100 }), tags: s.array(s.string({ max: 8 })) });
s.register(PKG, Config);
clientStd(PKG);
/** Registered, never marked client-readable. */
const SERVER = "@keel/std-cfgserveronlyunit";
s.register(SERVER, s.object({ apiKey: s.string() }));
const sim = () => createCtx({ mode: "sim", seed: SEED });

const config = fc.record({ limit: fc.integer({ min: 1, max: 100 }), tags: fc.array(fc.string({ maxLength: 8 })) });
const byModule = fc.dictionary(fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,8}$/), config, { minKeys: 1, maxKeys: 4 });

describe("bindClientStd (rfc:0069)", () => {
  it("property: the std of a #k-state text reaches stdConfig unchanged", () => {
    fc.assert(
      fc.property(byModule, (mods) => {
        const ctx = sim();
        bindClientStd(ctx, JSON.stringify({ stores: {}, islands: {}, std: { [PKG]: mods } }));
        expect(stdConfig(ctx, PKG, Config)).toEqual(mods);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("binds nothing for absent, unparsable or misshapen std", () => {
    for (const text of [null, undefined, "", "not json", '{"stores":{}}', '{"std":[1]}', '{"std":{"p":3}}', "null"]) {
      const ctx = sim();
      bindClientStd(ctx, text);
      expect(stdConfig(ctx, PKG, Config)).toEqual({});
    }
  });

  it("a value failing its package's registered schema throws E1158, as at createApp", () => {
    const text = JSON.stringify({ std: { [PKG]: { a: { limit: 0, tags: [] } } } });
    expect(() => bindClientStd(sim(), text)).toThrow(/^E1158 .*module a .*limit/);
  });
});

describe("clientStdData (rfc:0069, backlog 0199)", () => {
  it("property: keeps only clientStd packages and the given modules", () => {
    fc.assert(
      fc.property(byModule, byModule, fc.array(fc.string(), { maxLength: 3 }), (mods, other, extra) => {
        const keep = new Set([...Object.keys(mods).slice(0, 2), ...extra]);
        const data = { [PKG]: { ...other, ...mods }, [SERVER]: mods, "@keel/std-unmarked": other };
        const out = clientStdData(data, keep);
        expect(Object.keys(out).every((p) => p === PKG)).toBe(true);
        const kept = out[PKG] ?? {};
        for (const id of Object.keys(kept)) expect(keep.has(id)).toBe(true);
        for (const id of keep) if (Object.hasOwn(data[PKG] ?? {}, id)) expect(kept[id]).toEqual(data[PKG]?.[id]);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("is {} when no clientStd package configures a served module", () => {
    expect(clientStdData({ [SERVER]: { a: { apiKey: "x" } } }, new Set(["a"]))).toEqual({});
    expect(clientStdData({ [PKG]: { b: { limit: 1, tags: [] } } }, new Set(["a"]))).toEqual({});
  });
});

describe("generated entries bind std (rfc:0069)", () => {
  it("the resume entry binds #k-state's std to its ctx before resuming with that ctx", () => {
    const lines = RESUME_ENTRY.split("\n");
    const bind = lines.indexOf('bindClientStd(ctx, document.getElementById("k-state")?.textContent);');
    const run = lines.indexOf("resume(document.body, components, { ctx, stores: Object.fromEntries(stores()) });");
    expect(lines).toContain('import { bindClientStd } from "@keel/compiler/std/bindClientStd";');
    expect(bind).toBeGreaterThan(lines.indexOf('const ctx = createCtx({ mode: "real" });'));
    expect(run).toBeGreaterThan(bind);
    expect(parseSync("entry.js", RESUME_ENTRY, { sourceType: "module" }).errors).toEqual([]);
  });

  it("property: a client entry embeds std.json's data and binds it before the router starts; none imports nothing", () => {
    expect(entryCode(["/r.ts"], "c")).not.toContain("bindStd");
    fc.assert(
      fc.property(byModule, (mods) => {
        const code = entryCode(["/r.ts"], "c", { [PKG]: mods });
        const lines = code.split("\n");
        const bind = lines.findIndex((l) => l.startsWith("bindStd(ctx, "));
        expect(lines).toContain('import { bindStd } from "@keel/compiler/std/bindStd";');
        expect(bind).toBeGreaterThan(lines.indexOf('const ctx = createCtx({ mode: "real" });'));
        expect(lines.findIndex((l) => l.startsWith("const router = "))).toBeGreaterThan(bind);
        const literal = (lines[bind] ?? "").slice("bindStd(ctx, ".length, -");".length);
        expect(JSON.parse(literal)).toEqual({ [PKG]: mods });
        expect(parseSync("entry.js", code, { sourceType: "module" }).errors).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});

describe("vite plugin client entry (rfc:0069)", () => {
  let root = "";
  const saved = process.env.KEEL_DEPLOYABLE;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "keel-std-client-"));
    Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
  });
  afterEach(() => {
    if (saved === undefined) Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    else process.env.KEEL_DEPLOYABLE = saved;
    fs.rmSync(root, { recursive: true, force: true });
  });
  const write = (rel: string, text: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };

  const mod = (id: string, std: Record<string, unknown>): string =>
    `import { module } from '@keel/compiler'\nexport default module(${JSON.stringify({ id, deps: Object.keys(std), capabilities: [], public: { exports: [], routes: [] }, std })})\n`;

  it("a client deployable's entry binds only its own modules' clientStd config (backlog 0199)", async () => {
    write(
      "topology.ts",
      `export default { web: { modules: ["a"], adapter: "client" }, api: { modules: ["b"], adapter: "node" } };\n`,
    );
    write("modules/a/module.ts", mod("a", { [PKG]: { limit: 3, tags: ["x"] }, [SERVER]: { apiKey: "sk-a" } }));
    write("modules/b/module.ts", mod("b", { [PKG]: { limit: 4, tags: [] } }));
    const p = keel();
    p.configResolved({ root, command: "serve" });
    await p.buildStart.call({ warn: () => undefined });
    const code = String(await p.load(ENTRY_PATH));
    expect(code).toContain(`bindStd(ctx, ${JSON.stringify({ [PKG]: { a: { limit: 3, tags: ["x"] } } })});`);
    expect(code).not.toContain(SERVER);
    expect(code).not.toContain("sk-a");
    expect(code).not.toContain('"b":{');
  });
});
