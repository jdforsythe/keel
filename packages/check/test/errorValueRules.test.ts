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
