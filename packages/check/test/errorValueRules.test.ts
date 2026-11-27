// Examples beside the k.expect, k.attempt, k.supervise, k.realm and k.unsafe conformance: the edges each rule leaves clean.
import { check } from "@keel/check";
import { testTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";

const MANIFEST = {
  path: "modules/m/module.ts",
  source:
    "import { module } from '@keel/compiler'\nexport default module({ id: 'm', deps: [], capabilities: [], public: { exports: [] } })\n",
};
const codesOf = (source: string, codes: readonly string[], types = true): string[] =>
  check([MANIFEST, { path: "modules/m/a.ts", source }], { types })
    .diagnostics.filter((d) => d.path === "modules/m/a.ts" && codes.includes(d.code))
    .map((d) => `${d.code} ${d.line}:${d.col}`);

const HEAD =
  "import { attempt, err, ok } from '@keel/schema'\nimport type { KeelError, Result } from '@keel/schema'\ntype E = KeelError<'m.e', null>\ndeclare const T: E\ndeclare const f: () => number\n";

describe("type pass", { timeout: testTime(120_000) }, () => {
  it("an async function returning ok of a Result is E1459, a Promise<Result> written as T too", () => {
    const src = `${HEAD}declare const p: Promise<Result<number, E>>\nexport const a = ok(p)\nexport type B = Result<Promise<Result<number, E>>, E>\n`;
    expect(codesOf(src, ["E1459"])).toEqual(["E1459 7:21", "E1459 8:24"]);
  });

  it("an expect guarded by an if on a test, and one returning only undefined, decide; a non-test if does not", () => {
    const src = `${HEAD}export const a = attempt(f, (x) => { if (x instanceof TypeError) { return T } return undefined })\nexport const b = attempt(f, () => undefined)\nexport const c = attempt(f, (x) => { if (Math.random() > 0.5) return T; return undefined })\n`;
    expect(codesOf(src, ["E1452"])).toEqual(["E1452 8:29"]);
  });

  it("a returned constant error that does not read the thrown value carries nothing (no E1460)", () => {
    const src = `${HEAD}export const a = attempt(f, (x) => (x instanceof RangeError ? T : undefined))\n`;
    expect(codesOf(src, ["E1460", "E1452"])).toEqual([]);
  });

  it("err of a made error is no hand-written KeelError, and err of a hand-written one is one E1458", () => {
    const src = `${HEAD}export const a = err(T)\nexport const b = err({ code: 'm.e', message: 'm.e', data: null })\n`;
    expect(codesOf(src, ["E1458"])).toEqual(["E1458 7:22"]);
  });

  it("of a union holding a KeelError, a literal meant as the other member is no E1458; one naming code is", () => {
    const src = `${HEAD}type R = { raw: number; n: number } | E\nexport const a = (v: number): R => ({ raw: v, n: 1 })\nexport const b = (): R => ({ code: 'm.e', message: 'm.e', data: null })\nexport const c = (): { data: number } | E => ({ data: null })\n`;
    expect(codesOf(src, ["E1458"])).toEqual(["E1458 8:28", "E1458 9:47"]);
  });

  it("a listener for another event, and an onerror on an element, are no E1452", () => {
    const src =
      "declare const h: () => void\ndeclare const el: HTMLElement\nexport const a = () => addEventListener('click', h)\nexport const b = () => { el.onerror = h }\n";
    expect(codesOf(src, ["E1452"])).toEqual([]);
  });
});

describe("type pass: callees by symbol (k.unsafe One path)", { timeout: testTime(120_000) }, () => {
  it("Symbol.for through Reflect.apply and .call is E1766 at the call; stored, it is E1766 at the use", () => {
    const src =
      "export const a = Reflect.apply(Symbol.for, null, ['keel.x'])\nexport const b = Symbol.for.call(null, 'keel.y')\nexport const c = [Symbol.for]\n";
    expect(codesOf(src, ["E1766"])).toEqual(["E1766 1:18", "E1766 2:18", "E1766 3:19"]);
  });

  it("supervise through a const alias is E1461; ok and attempt stored are E1459 and E1452 at the use", () => {
    const src =
      "import { supervise } from '@keel/ctx'\nimport { attempt, ok } from '@keel/schema'\nconst sv = supervise\nexport const a = () => sv()\nexport const b = [ok, attempt]\n";
    expect(codesOf(src, ["E1461", "E1459", "E1452"])).toEqual(["E1461 4:24", "E1459 5:19", "E1452 5:23"]);
  });
});

describe("spelling rules", () => {
  it("a listener for uncaught throws is E1452 without the type pass", () => {
    const src =
      "declare const h: () => void\nexport const a = () => window.addEventListener('unhandledrejection', h)\nexport const b = () => { onerror = h }\nexport const c = () => process.once('uncaughtException', h)\nexport const d = () => addEventListener('click', h)\n";
    expect(codesOf(src, ["E1452"], false)).toEqual(["E1452 2:24", "E1452 3:26", "E1452 4:24"]);
  });

  it("supervise from another package, and a shadowed Symbol, are none", () => {
    const src =
      "import { supervise } from './own.ts'\nexport const a = supervise()\nconst Symbol = { for: (k: string) => k }\nexport const b = Symbol.for('keel.x')\n";
    expect(codesOf(src, ["E1461", "E1766"], false)).toEqual([]);
  });

  it("a const alias of supervise in app code is E1461 at the callee", () => {
    const src = "import { supervise } from '@keel/ctx'\nconst sv = supervise\nexport const a = () => sv()\n";
    expect(codesOf(src, ["E1461"], false)).toEqual(["E1461 3:24"]);
  });

  it("`Symbol.for` of a keel. text built from a const and a template folds", () => {
    const src = "const P = `keel`\nexport const a = Symbol.for(P + '.' + 'x')\nexport const b = Symbol.for(P + 'x')\n";
    expect(codesOf(src, ["E1766"], false)).toEqual(["E1766 2:18"]);
  });
});

describe("E1766 by what is done (k.realm The keel. names)", { timeout: testTime(120_000) }, () => {
  const SRC =
    "declare const o: object\nexport const a1 = Object.getOwnPropertyDescriptors(globalThis)\nexport const a2 = Object.getOwnPropertySymbols(Object(globalThis))\nexport const a3 = Reflect.ownKeys(Reflect.get(globalThis, 'globalThis'))\nexport const a4 = Object.getOwnPropertySymbols(globalThis.globalThis)\nexport const a5 = (g: typeof globalThis) => Reflect.ownKeys(g)\nexport const a6 = ({ ...globalThis })\nexport const a7 = Object.assign({}, globalThis)\nexport const a8 = Reflect.ownKeys(new Object(window))\nexport const c1 = [Object.keys(globalThis), Object.getOwnPropertyNames(globalThis), Object.assign(globalThis, {}), Reflect.ownKeys(o), [...[1]]]\n";
  it("each listing or copy of the global object is one E1766, by type with the pass and by name without", () => {
    expect(codesOf(SRC, ["E1766"])).toEqual([
      "E1766 2:19",
      "E1766 3:19",
      "E1766 4:19",
      "E1766 5:19",
      "E1766 6:45",
      "E1766 7:22",
      "E1766 8:19",
      "E1766 9:19",
    ]);
    expect(codesOf(SRC, ["E1766"], false)).toEqual([
      "E1766 2:19",
      "E1766 3:19",
      "E1766 4:19",
      "E1766 5:19",
      "E1766 7:22",
      "E1766 8:19",
      "E1766 9:19",
    ]);
  });
});

describe(
  "a library of the project's tree (k.library Kind, k.supervise Who writes it)",
  { timeout: testTime(120_000) },
  () => {
    const PKG = {
      path: "libs/sup/package.json",
      source: JSON.stringify({
        name: "@fx/sup",
        version: "0.0.0",
        type: "module",
        keel: "library",
        exports: { ".": { keel: "./src/index.ts" } },
      }),
    };
    const LIB_MANIFEST = {
      path: "libs/sup/module.ts",
      source:
        "import { module } from '@keel/compiler'\nexport default module({ id: 'sup', deps: [], capabilities: [], public: { exports: ['swallow'] } })\n",
    };
    const SWALLOW =
      "import { supervise } from '@keel/ctx'\nimport type { Ctx } from '@keel/ctx'\nimport type { KeelError } from '@keel/schema'\ndeclare const T: KeelError<'sup.t', null>\nexport function swallow(ctx: Ctx, f: () => number) { return supervise(ctx, 'sup.run', f, T) }\n";
    const e1461 = (files: { path: string; source: string }[], types: boolean) =>
      check(files, { types })
        .diagnostics.filter((d) => d.code === "E1461")
        .map((d) => d.path);
    it.each([true, false])("in place, its supervise call is no E1461 (types %s)", (types) => {
      expect(e1461([MANIFEST, PKG, LIB_MANIFEST, { path: "libs/sup/src/swallow.ts", source: SWALLOW }], types)).toEqual(
        [],
      );
    });
    it("without the marked package.json, the same file is app code: one E1461", () => {
      expect(e1461([MANIFEST, { path: "libs/sup/src/swallow.ts", source: SWALLOW }], false)).toEqual([
        "libs/sup/src/swallow.ts",
      ]);
    });
  },
);
