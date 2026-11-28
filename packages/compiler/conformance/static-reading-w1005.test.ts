// k.contract, Static reading "Keys are literal; the entries and each entry are object literals in the call, `method`, `path`, `layout` and `events` literals, `params`, `search` and `query` schemas read through consts and imports, other members any expression. A spread, call or name there (a const object's too) is E1111 at it; the entries beside it are read."
// k.compiler, Rules "W1005 reserved: no command reports it": the compiler's reading still names each part it leaves unread (`unread`), which E1111 reports.
// This file covers the compiler's reading (`unread` names each part `routeLiterals` leaves unread); the E1111 half is in @keel/check's conformance.
// Examples only: fixed projects. No random inputs (a fast-check seed would be 1337).
import fs from "node:fs";
import path from "node:path";
import { routeLiterals } from "@keel/compiler";
import type { SourceFile } from "@keel/compiler";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

let tmp = "";
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-static-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const HEAD = 'import { contract } from "@keel/router/contract";\nimport { s } from "@keel/schema";\n';
const MODULE =
  "import { module } from '@keel/compiler'\nexport default module({ id: 'm', deps: [], capabilities: [], public: { exports: [] } })\n";

function read(contractTs: string, extra: Record<string, string> = {}) {
  const files: Record<string, string> = {
    "modules/m/module.ts": MODULE,
    "modules/m/m.contract.ts": contractTs,
    "modules/m/routes.ts":
      'import { manifest } from "@keel/router";\nimport { m } from "./m.contract.ts";\nexport const routes = manifest(m, {});\n',
    ...extra,
  };
  const sources: SourceFile[] = Object.entries(files).map(([p, source]) => ({ path: p, source }));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
    fs.writeFileSync(path.join(tmp, rel), text);
  }
  return routeLiterals(sources, { root: tmp });
}

describe("k.contract Static reading, the compiler's unread parts", () => {
  test("a spread in place of a contract's entries is one unread part naming the spread, with the entries beside it still read", () => {
    const r = read(
      `${HEAD}declare const more: () => Record<string, never>;\nexport const m = contract("m", { ...more(), "m.home": { path: "/" } });\n`,
    );
    expect(r?.closed).toBe(false);
    expect(r?.unread).toHaveLength(1);
    expect(r?.unread[0]).toContain("...more()");
    expect(r?.routes["m.home"]).toMatchObject({ path: "/" });
  });

  test("a call in place of a contract's entries is one unread part naming the call", () => {
    const r = read(
      `${HEAD}declare const entries: () => Record<string, never>;\nexport const m = contract("m", entries());\n`,
    );
    expect(r?.closed).toBe(false);
    expect(r?.unread).toHaveLength(1);
    expect(r?.unread[0]).toContain("entries()");
  });

  test("a spread in place of one entry is one unread part naming the spread, with the other entries still read", () => {
    const r = read(
      `${HEAD}const base = { method: "GET" } as const;\nexport const m = contract("m", { "m.a": { ...base, path: "/a" }, "m.b": { path: "/b" } });\n`,
    );
    expect(r?.closed).toBe(false);
    expect(r?.unread).toHaveLength(1);
    expect(r?.unread[0]).toContain("...base");
    expect(r?.routes["m.b"]).toMatchObject({ path: "/b" });
  });

  test("a call in place of one entry is one unread part naming the call, with the other entries still read", () => {
    const r = read(
      `${HEAD}declare const mk: () => { path: string };\nexport const m = contract("m", { "m.a": mk(), "m.b": { path: "/b" } });\n`,
    );
    expect(r?.closed).toBe(false);
    expect(r?.unread).toHaveLength(1);
    expect(r?.unread[0]).toContain("mk()");
    expect(r?.routes["m.b"]).toMatchObject({ path: "/b" });
  });

  test("an entry whose `path` is not a literal is one unread part naming it, with the other entries still read", () => {
    const r = read(
      `${HEAD}const base = "/a";\nexport const m = contract("m", { "m.a": { method: "GET", path: base + "/x", output: s.object({}) }, "m.b": { path: "/b" } });\n`,
    );
    expect(r?.closed).toBe(false);
    expect(r?.unread).toHaveLength(1);
    expect(r?.routes["m.b"]).toMatchObject({ path: "/b" });
  });

  test("an entry whose `method` is not a literal is one unread part naming it, with the other entries still read", () => {
    const r = read(
      `${HEAD}declare const verb: "GET" | "POST";\nexport const m = contract("m", { "m.a": { method: verb, path: "/a", output: s.object({}) }, "m.b": { path: "/b" } });\n`,
    );
    expect(r?.closed).toBe(false);
    expect(r?.unread).toHaveLength(1);
    expect(r?.routes["m.b"]).toMatchObject({ path: "/b" });
  });

  test("`query` and `search` schemas reached through a const and through an import are read: nothing unread, the id set closed", () => {
    const r = read(
      `${HEAD}import { Imported } from "./Imported.schema.ts";\nconst Local = s.object({ q: s.string() });\nexport const m = contract("m", {\n  "m.viaConst": { method: "GET", path: "/c", query: Local, output: s.object({}) },\n  "m.viaImport": { method: "GET", path: "/i", query: Imported, output: s.object({}) },\n  "m.page": { path: "/p/:id", params: s.object({ id: s.string() }), search: Local },\n});\n`,
      {
        "modules/m/Imported.schema.ts":
          'import { s } from "@keel/schema";\nexport const Imported = s.object({ r: s.string() });\n',
      },
    );
    expect(r?.closed).toBe(true);
    expect(r?.unread).toEqual([]);
    expect(r?.routes["m.viaConst"]).toMatchObject({ path: "/c", method: "GET", search: true });
    expect(r?.routes["m.viaImport"]).toMatchObject({ path: "/i", method: "GET", search: true });
    expect(r?.routes["m.page"]).toMatchObject({ path: "/p/:id", params: true, search: true });
  });

  test("any other member may be any expression: a call in `output` or `body` leaves nothing unread", () => {
    const r = read(
      `${HEAD}declare const wrap: <T>(t: T) => T;\nexport const m = contract("m", { "m.a": { method: "POST", path: "/a", body: wrap(s.object({})), output: wrap(s.object({})) } });\n`,
    );
    expect(r?.closed).toBe(true);
    expect(r?.unread).toEqual([]);
    expect(r?.routes["m.a"]).toMatchObject({ path: "/a", method: "POST" });
  });
});
