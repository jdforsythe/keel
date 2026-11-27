// Spec: k.expect, clause "In `modules/m/a.ts`, with `E = s.error('m.t', s.object({}))` and `T = E.make({})`: `attempt(f, (x) => (void x, T))`, `attempt(f, (x) => (x === x ? T : undefined))`, `attempt(f, (x) => (x ? T : undefined))`, `attempt(f, (x) => E.make({}, typeof x))`, and `attempt(f, taken)` with `taken` imported from `./taken.ts` holding `export const taken = (_x: unknown) => T` are one E1452 each at the second argument, message `expect claims every throw: test the thrown value`, with no fix."
// Spec: k.expect, clause "There, `attempt(f, (x) => (x instanceof RangeError ? T : undefined))`, `attempt(f, (x) => (typeof x === 'object' && x !== null && Reflect.get(x, 'code') === '23505' ? T : undefined))`, `attempt(f, (x) => (x !== stop ? undefined : T))` with `stop` a `const` above it, `attempt(f, (x) => (isUnique(x) ? T : undefined))` with `isUnique` typed `(x: unknown) => boolean`, `attempt(f, (x) => { if (x instanceof TypeError) return T; return undefined })`, and `attempt(f, named)` with `const named = (x: unknown) => (x instanceof RangeError ? T : undefined)` in `./named.ts` are no E1452."
// Spec: k.expect, clause "There, `attempt(f, opts.expect)` with `opts` a parameter, `attempt(f, pick())` and `attempt(f, lib.expect)` with `lib` a namespace import of a package that is no library are one E1452 each at the second argument, message `expect is not readable here: write the function in the call`."
// Seed 1337. The forms are fixture source text checked with the type pass on (Decides 1 reads the return type).
import { check } from "@keel/check";
import { testTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";
import { type Files, manifestFile } from "./module-support.ts";

const M = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const TAKEN =
  "import { s } from '@keel/schema'\nexport const taken = (_x: unknown) => s.error('m.t', s.object({})).make({})\n";
const NAMED =
  "export const named = (x: unknown) => (x instanceof RangeError ? { code: 'm.t' as const, message: 'm.t', data: {} } : undefined)\n";
const NAMED_OK =
  "import { s } from '@keel/schema'\nconst E = s.error('m.t', s.object({}))\nexport const named = (x: unknown) => (x instanceof RangeError ? E.make({}) : undefined)\n";
const HEAD =
  "import { attempt, s } from '@keel/schema'\nimport { taken } from './taken.ts'\nimport { named } from './named.ts'\nconst E = s.error('m.t', s.object({}))\nconst T = E.make({})\nconst stop = Symbol('stop')\ndeclare const f: () => number\ndeclare const isUnique: (x: unknown) => boolean\ndeclare const opts: { expect: (x: unknown) => typeof T | undefined }\ndeclare const pick: () => (x: unknown) => typeof T | undefined\ndeclare const lib: { expect: (x: unknown) => typeof T | undefined }\n";
const CLAIMS = "expect claims every throw: test the thrown value";
const UNREADABLE = "expect is not readable here: write the function in the call";

/** One exported statement per form, so each form's line is its own. */
const diagsOf = (
  forms: readonly string[],
  named = NAMED,
): readonly { form: string; ds: ReturnType<typeof check>["diagnostics"] }[] => {
  const files: Files = [
    M,
    { path: "modules/m/taken.ts", source: TAKEN },
    { path: "modules/m/named.ts", source: named },
    { path: "modules/m/a.ts", source: `${HEAD}${forms.map((x, i) => `export const r${i} = ${x}`).join("\n")}\n` },
  ];
  const all = check(files, { types: true }).diagnostics.filter(
    (d) => d.path === "modules/m/a.ts" && /^E1452$/.test(d.code),
  );
  const base = HEAD.split("\n").length - 1;
  return forms.map((form, i) => ({ form, ds: all.filter((d) => d.line === base + i + 1) }));
};

describe("k.expect Decides: a total expect is E1452", { timeout: testTime(120_000) }, () => {
  const BAD = [
    "attempt(f, (x) => (void x, T))",
    "attempt(f, (x) => (x === x ? T : undefined))",
    "attempt(f, (x) => (x ? T : undefined))",
    "attempt(f, (x) => E.make({}, typeof x))",
    "attempt(f, taken)",
  ];
  for (const form of BAD) {
    it(`\`${form}\` is one E1452 at the second argument, message \`expect claims every throw: test the thrown value\`, with no fix`, () => {
      const [r] = diagsOf([form]);
      expect(r?.ds).toHaveLength(1);
      expect(r?.ds[0]?.message).toBe(CLAIMS);
      expect(r?.ds[0]?.fix).toBeUndefined();
      const col = form.indexOf(form.startsWith("attempt(f, taken") ? "taken" : "(x)") + `export const r0 = `.length + 1;
      expect(r?.ds[0]?.col).toBe(col);
    });
  }
});

describe("k.expect Decides: a test selects the claim", { timeout: testTime(120_000) }, () => {
  const CLEAN = [
    "attempt(f, (x) => (x instanceof RangeError ? T : undefined))",
    "attempt(f, (x) => (typeof x === 'object' && x !== null && Reflect.get(x, 'code') === '23505' ? T : undefined))",
    "attempt(f, (x) => (x !== stop ? undefined : T))",
    "attempt(f, (x) => (isUnique(x) ? T : undefined))",
    "attempt(f, (x) => { if (x instanceof TypeError) return T; return undefined })",
    "attempt(f, named)",
  ];
  for (const form of CLEAN) {
    it(`\`${form}\` is no E1452`, () => {
      const [r] = diagsOf([form], NAMED_OK);
      expect(r?.ds).toEqual([]);
    });
  }
});

describe("k.expect Readable", { timeout: testTime(120_000) }, () => {
  for (const form of ["attempt(f, opts.expect)", "attempt(f, pick())", "attempt(f, lib.expect)"]) {
    it(`\`${form}\` is one E1452 at the second argument, message \`expect is not readable here: write the function in the call\``, () => {
      const [r] = diagsOf([form]);
      expect(r?.ds).toHaveLength(1);
      expect(r?.ds[0]?.message).toBe(UNREADABLE);
      expect(r?.ds[0]?.col).toBe(form.indexOf(form.slice("attempt(f, ".length)) + `export const r0 = `.length + 1);
    });
  }
});
