import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const e1601 = (src: string): string[] =>
  check([{ path: "modules/app/a.ts", source: src }], { types: false })
    .diagnostics.filter((d) => d.code === "E1601")
    .map((d) => d.message);

const BAD: [string, string][] = [
  ["globalThis.Date.now()", "export const a = (): number => globalThis.Date.now();"],
  ["window.Date.now()", "export const a = (): number => window.Date.now();"],
  ["Date['now']()", "export const a = (): number => Date['now']();"],
  ["Math['random']()", "export const a = (): number => Math['random']();"],
  ["Date()", "export const a = (): string => Date();"],
  ["new Date()", "export const a = (): Date => new Date();"],
  ["performance.now", "export const a = (): number => performance.now();"],
  ["globalThis.performance.now", "export const a = (): number => globalThis.performance.now();"],
  ["crypto.getRandomValues", "export const a = (): unknown => crypto.getRandomValues(new Uint8Array(1));"],
  ["setTimeout", "export const a = (): unknown => setTimeout(() => 1, 5);"],
  ["setInterval", "export const a = (): unknown => globalThis.setInterval(() => 1, 5);"],
  ["requestAnimationFrame", "export const a = (): unknown => requestAnimationFrame(() => 1);"],
  ["fetch", "export const a = (): unknown => fetch('/x');"],
  ["new XMLHttpRequest", "export const a = (): unknown => new XMLHttpRequest();"],
  ["new WebSocket", "export const a = (): unknown => new WebSocket('ws://x');"],
  ["new EventSource", "export const a = (): unknown => new globalThis.EventSource('/x');"],
  ["localStorage", "export const a = (): unknown => localStorage.getItem('k');"],
  ["sessionStorage", "export const a = (): unknown => sessionStorage.getItem('k');"],
  ["indexedDB", "export const a = (): unknown => indexedDB.open('db');"],
  ["document.cookie", "export const a = (): string => document.cookie;"],
];

describe("E1601 ambient effects", () => {
  for (const [name, src] of BAD)
    it(`flags ${name}`, () => {
      expect(e1601(src)).toHaveLength(1);
    });

  it("does not flag a locally declared name or ctx use", () => {
    expect(e1601("const performance = { now: () => 1 };\nexport const a = (): number => performance.now();")).toEqual(
      [],
    );
    expect(e1601("export const a = (ctx: { clock: { now(): number } }): number => ctx.clock.now();")).toEqual([]);
    expect(e1601("export const a = (): Date => new Date(5);")).toEqual([]);
  });

  it("fixes map to the ctx equivalent where one is exact", () => {
    const fix = (src: string): string | undefined =>
      check([{ path: "modules/app/a.ts", source: src }], { types: false }).diagnostics.find((d) => d.code === "E1601")
        ?.fix;
    expect(fix("export const a = (ctx: Ctx): number => globalThis.Date.now();")).toContain(
      "+export const a = (ctx: Ctx): number => ctx.clock.now();",
    );
    expect(fix("export const a = (ctx: Ctx): number => Math['random']();")).toContain("ctx.random.float()");
    expect(fix("export const a = ({ ctx }: P): unknown => globalThis.fetch('/x');")).toContain("ctx.net.fetch('/x')");
    expect(fix("export const a = (ctx: Ctx): Date => new Date();")).toContain("new Date(ctx.clock.now())");
    expect(fix("export const a = (ctx: Ctx): number => performance.now();")).toBeUndefined();
  });

  it("offers no fix where no binding named ctx is in scope, and still names the equivalent", () => {
    const first = (src: string) =>
      check([{ path: "modules/app/a.ts", source: src }], { types: false }).diagnostics.find((d) => d.code === "E1601");
    for (const src of [
      "export const a = (): unknown => fetch('/x');",
      "export const a = (): number => Date.now();",
      "export const a = (c: Ctx): Date => new Date();",
      "const f = (ctx: Ctx) => ctx;\nexport const a = (): number => Math.random();",
    ]) {
      const d = first(src);
      expect(d?.fix, src).toBeUndefined();
      expect(d?.message ?? "", src).toMatch(/; use (ctx\.|new Date\(ctx)/);
    }
  });
});

const e1603 = (src: string, path = "modules/app/a.ts"): string[] =>
  check([{ path, source: src }], { types: false })
    .diagnostics.filter((d) => d.code === "E1603")
    .map((d) => `${d.line}:${d.col}`);
const at = (src: string): string[] =>
  check([{ path: "modules/app/a.ts", source: src }], { types: false })
    .diagnostics.filter((d) => d.code === "E1601")
    .map((d) => `${d.line}:${d.col} ${d.message}`);

describe("E1601 resolution (rfc:0053)", () => {
  const ONE: [string, string][] = [
    ["const alias", "const D = Date\nexport const a = (): number => D.now()"],
    ["template key", "export const a = (): number => Date[`now`]()"],
    ["const string key", "const k = 'now'\nexport const a = (): number => Date[k]()"],
    ["concatenated key", "export const a = (): number => Math['ran' + 'dom']()"],
    ["destructured", "const { random } = Math\nexport const a = (): number => random()"],
    ["destructured rename", "const { now: n } = Date\nexport const a = (): number => n()"],
    ["nested destructuring", "const { Date: { now } } = globalThis\nexport const a = (): number => now()"],
    ["global object alias", "const g = window\nexport const a = (): number => g.Math.random()"],
    ["parameter default", "export const a = (D = Date): number => D.now()"],
    ["let never assigned", "let D = Date\nexport const a = (): number => D.now()"],
    ["var in block hoists", "export function a(): number {\n  if (1) {\n    var D = Date\n  }\n  return D.now()\n}"],
    ["function alias used as value", "const n = Date.now\nexport const a = (): number[] => [1].map(n)"],
    ["alias of storage", "const ls = localStorage\nexport const a = (): unknown => ls.getItem('k')"],
    ["paren and as", "export const a = (): number => (Date as DateConstructor).now()"],
    ["comma expression", "export const a = (): number => (0, Math.random)()"],
    ["new through alias", "const D = Date\nexport const a = (): Date => new D()"],
    ["bare fetch reference", "export const a = (): unknown => [fetch]"],
    ["re-export of alias", "const now = Date.now\nexport { now }"],
    ["exported alias at initializer", "export const now = Date.now"],
    ["optional call", "export const a = (): number | undefined => Date?.now()"],
    ["exported whole Date (0151)", "export const D = Date"],
    ["exported whole Math (0151)", "export const M = Math"],
    ["exported destructured member (0151)", "export const { now } = Date"],
    ["export specifier of a whole global (0151)", "const D = Date\nexport { D }"],
    ["export default of a whole global (0151)", "const D = Date\nexport default D"],
  ];
  for (const [name, src] of ONE)
    it(`one E1601: ${name}`, () => {
      expect(at(src)).toHaveLength(1);
    });

  it("reports an alias chain at the call, with the resolved name", () => {
    expect(at("const a = Math\nconst b = a.random\nconst c = b\nexport const t = (): number => c()")).toEqual([
      "4:32 Math.random() outside ctx; use ctx.random.float()",
    ]);
  });

  const NONE: [string, string][] = [
    [
      "block-scoped shadow",
      "export const a = (clock: { now(): number }): number => {\n  const Date = clock\n  return Date.now()\n}",
    ],
    ["parameter shadow", "export const a = (Date: { now(): number }): number => Date.now()"],
    [
      "catch shadow",
      "export const a = (): number => {\n  try {\n    return 1\n  } catch (Math) {\n    return Math.random()\n  }\n}",
    ],
    ["let reassigned", "let D: { now(): number } = Date\nD = { now: () => 1 }\nexport const a = (): number => D.now()"],
    ["cycle", "const a: never = b\nconst b: never = a\nexport const t = (): unknown => a"],
    ["dynamic key", "export const a = (k: 'now'): number => Date[k]()"],
    ["typeof feature test", "export const a = (): boolean => typeof fetch === 'function'"],
    ["unused alias", "const D = Date.now\nexport const a = 1"],
    ["Math.floor through alias", "const M = Math\nexport const a = (): number => M.floor(1.5)"],
    ["import named like a global", "import { now } from './clock.ts'\nexport const a = (): number => now()"],
    ["constructor constant (0153)", "export const a = (): number => WebSocket.OPEN"],
    ["constructor constant via window (0153)", "export const a = (): number => window.WebSocket.OPEN"],
    ["instanceof operand (0153)", "export const a = (x: unknown): boolean => x instanceof XMLHttpRequest"],
    ["unexported whole global", "const D = Date\nexport const a = (): Date => new D(5)"],
  ];
  for (const [name, src] of NONE)
    it(`no E1601: ${name}`, () => {
      expect(at(src)).toEqual([]);
    });

  it("an exported whole global is reported at the exported name (0151)", () => {
    expect(at("export const D = Date")).toEqual(["1:14 Date outside ctx; use the ctx capability"]);
    expect(at("export const { now } = Date")).toEqual(["1:16 Date.now outside ctx; use the ctx capability"]);
    expect(at("const M = Math\nexport { M as Rand }")).toEqual(["2:10 Math outside ctx; use the ctx capability"]);
  });

  it("a shadow in one function does not hide the global in another", () => {
    const src =
      "export const a = (Date: { now(): number }): number => Date.now()\nexport const b = (): number => Date.now()";
    expect(at(src)).toEqual(["2:32 Date.now() outside ctx; use ctx.clock.now()"]);
  });
});

describe("E1603 code from a string (rfc:0053)", () => {
  it("reports eval, Function and their aliases once each", () => {
    expect(e1603("export const a = (s: string): unknown => eval(s)")).toEqual(["1:42"]);
    expect(e1603("export const a = (s: string): unknown => (0, eval)(s)")).toEqual(["1:46"]);
    expect(e1603("export const a = (s: string): unknown => globalThis['eval'](s)")).toEqual(["1:42"]);
    expect(e1603("export const a = (s: string): unknown => new Function(s)")).toEqual(["1:46"]);
    expect(e1603("const F = Function\nexport const a = (s: string): unknown => F(s)")).toEqual(["2:42"]);
    expect(e1603("export const a = (s: string): unknown => Function.call(null, s)")).toEqual(["1:42"]);
    expect(e1603("export const a = (s: string): unknown => Reflect.construct(Function, [s])")).toEqual(["1:60"]);
    expect(e1603("export const e = eval")).toEqual(["1:18"]);
    expect(e1603("export const a = (s: string): unknown => eval(s)", "test/a.test.ts")).toEqual(["1:42"]);
  });

  it("does not report Function as a value, a local eval-like binding, or non-app code", () => {
    expect(e1603("export const a = (x: unknown): boolean => x instanceof Function")).toEqual([]);
    expect(e1603("const Function = (s: string): string => s\nexport const a = (): string => Function('x')")).toEqual(
      [],
    );
    expect(e1603("export const a = (s: string): unknown => eval(s)", "vite.config.ts")).toEqual([]);
  });

  it("reports in a file under unsafe/ (the pipeline lifts it inside a lifted range only)", () => {
    expect(e1603("export const a = (s: string): unknown => eval(s)", "unsafe/a.ts")).toHaveLength(1);
  });
});
