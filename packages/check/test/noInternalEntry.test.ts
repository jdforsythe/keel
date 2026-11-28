// E1576 examples pinned by location and message, and E1251 on the same specifier walk.
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const out = (code: string, source: string, path = "modules/a/x.ts"): string[] =>
  check([{ path, source }], { types: false })
    .diagnostics.filter((d) => d.code === code)
    .map((d) => `${d.line}:${d.col} ${d.message}`);

describe("E1576 internal entry outside packages", () => {
  it("names the specifier at the statement start", () => {
    expect(out("E1576", "export const a = 1\nimport { report } from '@keel/ctx/internal'\n")).toEqual([
      "2:1 @keel/ctx/internal is internal to Keel packages; use a public entry",
    ]);
  });

  it("reports a call at its start, nested in a function", () => {
    expect(out("E1576", "export const f = () => {\n  return import('@keel/store/internal/x')\n}\n")).toEqual([
      "2:10 @keel/store/internal/x is internal to Keel packages; use a public entry",
    ]);
  });

  it("reports a deep path and a file under unsafe/ and a tool script", () => {
    expect(out("E1576", "import '@keel/store/src/internal/serverState.ts'\n")).toHaveLength(1);
    expect(out("E1576", "import '@keel/ctx/internal'\n", "modules/a/unsafe/x.ts")).toHaveLength(1);
    expect(out("E1576", "import '@keel/ctx/internal'\n", "scripts/seed.mjs")).toHaveLength(1);
  });

  it("reads a template-literal import() with no substitutions, and anchors packages/ at the root", () => {
    expect(out("E1576", "export const m = () => import(`@keel/ctx/internal`)\n")).toHaveLength(1);
    expect(out("E1576", "import '@keel/ctx/internal'\n", "apps/web/packages/x.ts")).toHaveLength(1);
  });

  it("reports a `#` specifier as possibly internal, whatever it names", () => {
    expect(out("E1576", "import { a } from '#lib/a'\nexport const x = a\n")).toEqual([
      "1:1 #lib/a may name a Keel internal entry; use a relative path or package name",
    ]);
    expect(out("E1576", "import { a } from '#lib/a'\nexport const x = a\n", "packages/std-x/src/x.ts")).toEqual([]);
  });

  it("does not follow a computed specifier, a segment that only contains internal, or a non-@keel package", () => {
    expect(out("E1576", "const n = '@keel/ctx/internal'\nexport const m = import(n)\n")).toEqual([]);
    expect(out("E1576", "import '@keel/ctx/internals'\nimport '@keel/internal'\nimport 'x/internal'\n")).toEqual([]);
  });

  it("does not read a require that is a local call on a member", () => {
    expect(out("E1576", "export const m = mod.require('@keel/ctx/internal')\n")).toEqual([]);
  });

  it("skips files that are not code", () => {
    expect(out("E1576", "import '@keel/ctx/internal'\n", "modules/a/x.d.ts")).toEqual([]);
  });
});

describe("E1251 on the shared specifier walk", () => {
  it("reports import, re-export and import() of ops, not require", () => {
    const src =
      "import { template } from '@keel/runtime-dom/ops'\nexport * from '@keel/runtime-dom/ops'\nexport const m = () => import('@keel/runtime-dom/ops')\nexport const r = require('@keel/runtime-dom/ops')\n";
    expect(out("E1251", src).map((s) => s.split(" ")[0])).toEqual(["1:1", "2:1", "3:24"]);
  });
});
