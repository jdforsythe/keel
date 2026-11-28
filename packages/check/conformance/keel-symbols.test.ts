// Spec: k.realm, clause "In `modules/m/a.ts`, `Symbol.for('keel.kernel')`, `` Symbol.for(`keel.census`) ``, `Symbol.for(K)` with `const K = 'keel.' + 'result'` above it, `Object.getOwnPropertySymbols(globalThis)` and `Reflect.ownKeys(window)` are one E1766 each at the call, message `keel. symbols are the kernel's: app and library code names none`, with no fix; `Symbol.for('app.key')`, `Symbol('keel.x')` and `Reflect.ownKeys(obj)` are none."
// Seed 1337. One file of fixture source text, type pass on; each case reads the diagnostics of its own line.
import { check } from "@keel/check";
import { testTime } from "@keel/tooling/test-time";
import { beforeAll, describe, expect, it } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";

const M = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const MESSAGE = "keel. symbols are the kernel's: app and library code names none";
const HEAD = "const K = 'keel.' + 'result'\ndeclare const obj: object\ndeclare const window: object\n";
const LINES = [
  "export const a1 = Symbol.for('keel.kernel')",
  "export const a2 = Symbol.for(`keel.census`)",
  "export const a3 = Symbol.for(K)",
  "export const a4 = Object.getOwnPropertySymbols(globalThis)",
  "export const a5 = Reflect.ownKeys(window)",
  "export const c1 = Symbol.for('app.key')",
  "export const c2 = Symbol('keel.x')",
  "export const c3 = Reflect.ownKeys(obj)",
];
const base = HEAD.split("\n").length - 1;
const source = `${HEAD}${LINES.join("\n")}\n`;
let all: ReturnType<typeof check>["diagnostics"] = [];
beforeAll(() => {
  all = check([M, { path: "modules/m/a.ts", source }], { types: true }).diagnostics.filter(
    (d) => d.path === "modules/m/a.ts" && d.code === "E1766",
  );
}, testTime(120_000));
const onLine = (i: number) => all.filter((d) => d.line === base + i + 1);

describe("k.realm The keel. names: E1766", () => {
  const BAD = [
    "Symbol.for('keel.kernel')",
    "Symbol.for(`keel.census`)",
    "Symbol.for(K) with K = 'keel.' + 'result'",
    "Object.getOwnPropertySymbols(globalThis)",
    "Reflect.ownKeys(window)",
  ];
  BAD.forEach((name, i) => {
    it(`\`${name}\` is one E1766 at the call, message \`${MESSAGE}\`, with no fix`, () => {
      expect(onLine(i)).toHaveLength(1);
      expect(onLine(i)[0]?.message).toBe(MESSAGE);
      expect(onLine(i)[0]?.fix).toBeUndefined();
      expect(onLine(i)[0]?.col).toBe((LINES[i] ?? "").indexOf(" = ") + 4);
    });
  });
  ["Symbol.for('app.key')", "Symbol('keel.x')", "Reflect.ownKeys(obj)"].forEach((name, j) => {
    it(`\`${name}\` is none`, () => {
      expect(onLine(5 + j)).toEqual([]);
    });
  });

  it(
    "the same call in a library's file (`node_modules/@acme/jobs/src/x.ts`) is one E1766",
    () => {
      const files: Files = [
        M,
        {
          path: "node_modules/@acme/jobs/package.json",
          source: JSON.stringify({ name: "@acme/jobs", version: "1.0.0", type: "module", keel: "library" }),
        },
        manifestFile({ id: "jobs", deps: [], capabilities: [], exports: [] }, "node_modules/@acme/jobs"),
        { path: "node_modules/@acme/jobs/src/x.ts", source: "export const a = Symbol.for('keel.kernel')\n" },
      ];
      const ds = check(files, { types: false }).diagnostics.filter((d) => d.code === "E1766");
      expect(ds).toHaveLength(1);
      expect(ds[0]?.message).toBe(MESSAGE);
    },
    testTime(120_000),
  );
});
