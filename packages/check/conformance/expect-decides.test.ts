// Spec: k.expect, clause "In `modules/m/a.ts`, with `E = s.error('m.t', s.object({}))` and `T = E.make({})`: `attempt(f, (x) => (void x, T))`, `attempt(f, (x) => (x === x ? T : undefined))`, `attempt(f, (x) => (x ? T : undefined))`, `attempt(f, (x) => E.make({}, typeof x))`, and `attempt(f, taken)` with `taken` imported from `./taken.ts` holding `export const taken = (_x: unknown) => T` are one E1452 each at the second argument, with no fix: the first, fourth and fifth with message `expect claims every throw: it never returns undefined`, the second and third with `expect claims every throw: return the error where instanceof, ===, a guard or .ok holds`."
// Spec: k.expect, clause "There, `attempt(f, (x) => (x instanceof RangeError ? T : undefined))`, `attempt(f, (x) => (typeof x === 'object' && x !== null && Reflect.get(x, 'code') === '23505' ? T : undefined))`, `attempt(f, (x) => (x !== stop ? undefined : T))` with `stop` a `const` above it, `attempt(f, (x) => (isUnique(x) ? T : undefined))` with `isUnique` typed `(x: unknown) => boolean`, `attempt(f, (x) => { if (x instanceof TypeError) return T; return undefined })`, and `attempt(f, named)` with `const named = (x: unknown) => (x instanceof RangeError ? T : undefined)` in `./named.ts` are no E1452."
// Spec: k.expect, clause "There, `attempt(f, opts.expect)` with `opts` a parameter, `attempt(f, pick())` and `attempt(f, lib.expect)` with `lib` a namespace import of a package that is no library are one E1452 each at the second argument, message `expect is not readable here: write the function in the call`."
// Spec: k.expect, clause "There, with `class H extends Error { status = 0 }` and `C = s.enum(['23505'])`: `attempt(f, (x) => { if (!(x instanceof H)) return undefined; return T })`, `attempt(f, (x) => { if (!(x instanceof H)) return; switch (x.status) { case 503: return T; default: return undefined } })`, `attempt(f, (x) => { const r = C.parse(Reflect.get(Object(x), 'code')); if (!r.ok) return undefined; return T })` and `attempt(f, (x) => (Reflect.get(Object(x), 'code') === '23505' ? T : undefined))` are no E1452; `attempt(f, (x) => { if (x === x) return undefined; return T })` and `attempt(f, (x) => { switch (x) { default: return T; case 1: return undefined } })` are one each at the second argument, message `expect claims every throw: return the error where instanceof, ===, a guard or .ok holds`."
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
  "import { attempt, s } from '@keel/schema'\nimport { taken } from './taken.ts'\nimport { named } from './named.ts'\nconst E = s.error('m.t', s.object({}))\nconst T = E.make({})\nconst stop = Symbol('stop')\nclass H extends Error { status = 0 }\nconst C = s.enum(['23505'])\ndeclare const f: () => number\ndeclare const isUnique: (x: unknown) => boolean\ndeclare const opts: { expect: (x: unknown) => typeof T | undefined }\ndeclare const pick: () => (x: unknown) => typeof T | undefined\ndeclare const lib: { expect: (x: unknown) => typeof T | undefined }\n";
const NEVER = "expect claims every throw: it never returns undefined";
const UNSELECTED = "expect claims every throw: return the error where instanceof, ===, a guard or .ok holds";
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
  const BAD: readonly (readonly [string, string])[] = [
    ["attempt(f, (x) => (void x, T))", NEVER],
    ["attempt(f, (x) => (x === x ? T : undefined))", UNSELECTED],
    ["attempt(f, (x) => (x ? T : undefined))", UNSELECTED],
    ["attempt(f, (x) => E.make({}, typeof x))", NEVER],
    ["attempt(f, taken)", NEVER],
  ];
  for (const [form, message] of BAD) {
    it(`\`${form}\` is one E1452 at the second argument, message \`${message}\`, with no fix`, () => {
      const [r] = diagsOf([form]);
      expect(r?.ds).toHaveLength(1);
      expect(r?.ds[0]?.message).toBe(message);
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

describe("k.expect Decides: the shapes that select a returned value", { timeout: testTime(120_000) }, () => {
  const CLEAN = [
    "attempt(f, (x) => { if (!(x instanceof H)) return undefined; return T })",
    "attempt(f, (x) => { if (!(x instanceof H)) return; switch (x.status) { case 503: return T; default: return undefined } })",
    "attempt(f, (x) => { const r = C.parse(Reflect.get(Object(x), 'code')); if (!r.ok) return undefined; return T })",
    "attempt(f, (x) => (Reflect.get(Object(x), 'code') === '23505' ? T : undefined))",
  ];
  for (const form of CLEAN) {
    it(`\`${form}\` is no E1452`, () => {
      const [r] = diagsOf([form], NAMED_OK);
      expect(r?.ds).toEqual([]);
    });
  }
  const BAD = [
    "attempt(f, (x) => { if (x === x) return undefined; return T })",
    "attempt(f, (x) => { switch (x) { default: return T; case 1: return undefined } })",
  ];
  for (const form of BAD) {
    it(`\`${form}\` is one E1452 at the second argument, message \`${UNSELECTED}\``, () => {
      const [r] = diagsOf([form], NAMED_OK);
      expect(r?.ds).toHaveLength(1);
      expect(r?.ds[0]?.message).toBe(UNSELECTED);
      expect(r?.ds[0]?.col).toBe(form.indexOf("(x)") + `export const r0 = `.length + 1);
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
