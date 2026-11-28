// Spec: k.realm, clause "In `modules/m/a.ts`, with the type pass on, `Object.getOwnPropertyDescriptors(globalThis)`, `Object.getOwnPropertySymbols(Object(globalThis))`, `Reflect.ownKeys(Reflect.get(globalThis, 'globalThis'))`, `Object.getOwnPropertySymbols(globalThis.globalThis)`, `Reflect.ownKeys(new Object(window))`, `Reflect.ownKeys(g)` in `(g: typeof globalThis) => Reflect.ownKeys(g)`, `({ ...globalThis })` and `Object.assign({}, globalThis)` are one E1766 each, at the call or, for the spread, at the `...`, message `keel. symbols are the kernel's: app and library code names none`, with no fix; the same holds with the type pass off but for `Reflect.ownKeys(g)`; `Object.keys(globalThis)`, `Object.getOwnPropertyNames(globalThis)`, `Object.assign(globalThis, {})` and `Reflect.ownKeys(o)` with `declare const o: object` are none."
// Seed 1337 (no generated input: the forms are source text). One file of fixture source text per pass; each case reads the diagnostics of its own line.
// Reading: "the same holds with the type pass off but for `Reflect.ownKeys(g)`" is read as: with the type pass off, `Reflect.ownKeys(g)` is none, and every other form keeps its answer.
// `window` is declared in the fixture as keel-symbols.test.ts declares it, so the file type-checks without the DOM library.
import { check } from "@keel/check";
import { testTime } from "@keel/tooling/test-time";
import { beforeAll, describe, expect, it } from "vitest";
import { manifestFile } from "./module-support.ts";

const M = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const MESSAGE = "keel. symbols are the kernel's: app and library code names none";
const HEAD = "declare const o: object\ndeclare const window: object\n";
/** Each listing or copy, the line it stands on, and the text its diagnostic starts at. */
const BAD: readonly (readonly [string, string])[] = [
  ["export const a1 = Object.getOwnPropertyDescriptors(globalThis)", "Object.getOwnPropertyDescriptors("],
  ["export const a2 = Object.getOwnPropertySymbols(Object(globalThis))", "Object.getOwnPropertySymbols("],
  ["export const a3 = Reflect.ownKeys(Reflect.get(globalThis, 'globalThis'))", "Reflect.ownKeys("],
  ["export const a4 = Object.getOwnPropertySymbols(globalThis.globalThis)", "Object.getOwnPropertySymbols("],
  ["export const a5 = Reflect.ownKeys(new Object(window))", "Reflect.ownKeys("],
  ["export const a6 = (g: typeof globalThis) => Reflect.ownKeys(g)", "Reflect.ownKeys("],
  ["export const a7 = ({ ...globalThis })", "..."],
  ["export const a8 = Object.assign({}, globalThis)", "Object.assign("],
];
const NONE = [
  "export const c1 = Object.keys(globalThis)",
  "export const c2 = Object.getOwnPropertyNames(globalThis)",
  "export const c3 = Object.assign(globalThis, {})",
  "export const c4 = Reflect.ownKeys(o)",
];
const LINES = [...BAD.map(([line]) => line), ...NONE];
const base = HEAD.split("\n").length - 1;
const source = `${HEAD}${LINES.join("\n")}\n`;
const run = (types: boolean) =>
  check([M, { path: "modules/m/a.ts", source }], { types }).diagnostics.filter(
    (d) => d.path === "modules/m/a.ts" && d.code === "E1766",
  );
let on: ReturnType<typeof run> = [];
let off: ReturnType<typeof run> = [];
beforeAll(() => {
  on = run(true);
  off = run(false);
}, testTime(240_000));
const onLine = (ds: ReturnType<typeof run>, i: number) => ds.filter((d) => d.line === base + i + 1);

for (const [pass, types] of [
  ["on", true],
  ["off", false],
] as const) {
  describe(`k.realm The keel. names: a listing of the global object's symbol keys, type pass ${pass}`, () => {
    BAD.forEach(([line, at], i) => {
      const form = line.slice(line.indexOf(" = ") + 3);
      if (!types && i === 5) {
        it(`\`${form}\` is none with the type pass off`, () => {
          expect(onLine(off, i)).toEqual([]);
        });
        return;
      }
      it(`\`${form}\` is one E1766 at ${at === "..." ? "the `...`" : "the call"}, message \`${MESSAGE}\`, with no fix`, () => {
        const ds = onLine(types ? on : off, i);
        expect(ds).toHaveLength(1);
        expect(ds[0]?.message).toBe(MESSAGE);
        expect(ds[0]?.fix).toBeUndefined();
        expect(ds[0]?.col).toBe(line.indexOf(at, line.indexOf(" = ")) + 1);
      });
    });
    NONE.forEach((line, j) => {
      it(`\`${line.slice(line.indexOf(" = ") + 3)}\` is none`, () => {
        expect(onLine(types ? on : off, BAD.length + j)).toEqual([]);
      });
    });
  });
}
