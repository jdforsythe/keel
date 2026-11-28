// Spec: k.unsafe, clause "In `modules/m/a.ts`, with `p` a `Promise<number>`, `k` a `string` and `g` a `Generator<number>`: `const { then } = p` is one E1452 at `then`; `p[k](h)` is one E1452 at `k`, message `promise member chosen at run time; check cannot follow it`; `g.throw(x)` is one diagnostic of the `throw` rule (k.errors Rules) at the callee; `addEventListener('unhandledrejection', (e) => e.preventDefault())`, `window.onerror = h` and `process.on('uncaughtException', h)` are one E1452 each, message `listener for uncaught throws in app code: the Boundary and the server own them`; `button.addEventListener('error', h)` with `button` an `HTMLElement`, `p['then'](h)` and `g.next()` are none of these."
// Seed 1337. One file holds the six reported lines and the three clean ones, type pass on; each case reads the diagnostics of its own line.
import { check } from "@keel/check";
import { testTime } from "@keel/tooling/test-time";
import { beforeAll, describe, expect, it } from "vitest";
import { manifestFile } from "./module-support.ts";

const M = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const HEAD =
  "declare const p: Promise<number>\ndeclare const k: string\ndeclare const g: Generator<number>\ndeclare const h: () => void\ndeclare const x: unknown\ndeclare const button: HTMLElement\n";
const LINES = [
  "export const a1 = () => { const { then } = p; return then }",
  "export const a2 = () => p[k](h)",
  "export const a3 = () => g.throw(x)",
  "export const a4 = () => addEventListener('unhandledrejection', (e) => e.preventDefault())",
  "export const a5 = () => { window.onerror = h }",
  "export const a6 = () => process.on('uncaughtException', h)",
  "export const c1 = () => button.addEventListener('error', h)",
  "export const c2 = () => p['then'](h)",
  "export const c3 = () => g.next()",
];
const base = HEAD.split("\n").length - 1;
const source = `${HEAD}${LINES.join("\n")}\n`;
let all: ReturnType<typeof check>["diagnostics"] = [];
beforeAll(() => {
  all = check([M, { path: "modules/m/a.ts", source }], { types: true }).diagnostics.filter(
    (d) => d.path === "modules/m/a.ts" && /^E14[0-9]{2}$/.test(d.code),
  );
}, testTime(120_000));
const onLine = (i: number) => all.filter((d) => d.line === base + i + 1);
const col = (i: number, needle: string) => (LINES[i] ?? "").indexOf(needle) + 1;
const LISTENER = "listener for uncaught throws in app code: the Boundary and the server own them";

describe("k.unsafe Other spellings", () => {
  it("`const { then } = p` is one E1452 at `then`", () => {
    expect(onLine(0).map((d) => d.code)).toEqual(["E1452"]);
    expect(onLine(0)[0]?.col).toBe(col(0, "then"));
  });
  it("`p[k](h)` is one E1452 at `k`, message `promise member chosen at run time; check cannot follow it`", () => {
    expect(onLine(1).map((d) => d.code)).toEqual(["E1452"]);
    expect(onLine(1)[0]?.message).toBe("promise member chosen at run time; check cannot follow it");
    expect(onLine(1)[0]?.col).toBe(col(1, "[k]") + 1);
  });
  it("`g.throw(x)` is one diagnostic of the throw rule (E1451) at the callee", () => {
    expect(onLine(2).map((d) => d.code)).toEqual(["E1451"]);
    expect(onLine(2)[0]?.col).toBe(col(2, "g.throw"));
  });
  for (const [i, name] of [
    [3, "`addEventListener('unhandledrejection', (e) => e.preventDefault())`"],
    [4, "`window.onerror = h`"],
    [5, "`process.on('uncaughtException', h)`"],
  ] as const) {
    it(`${name} is one E1452, message \`${LISTENER}\``, () => {
      expect(onLine(i).map((d) => d.code)).toEqual(["E1452"]);
      expect(onLine(i)[0]?.message).toBe(LISTENER);
    });
  }
  for (const [i, name] of [
    [6, "`button.addEventListener('error', h)` with `button` an `HTMLElement`"],
    [7, "`p['then'](h)`"],
    [8, "`g.next()`"],
  ] as const) {
    it(`${name} is none of these`, () => {
      expect(onLine(i)).toEqual([]);
    });
  }
});
