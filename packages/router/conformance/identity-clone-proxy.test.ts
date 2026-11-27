// @vitest-environment happy-dom
// Spec: k.identity, clause "`isDefect`, `isSchema`, `isStore`, `isTransaction` and `isRouteTable` are each false of `structuredClone` of a value it is true of, where the clone can be made, and of `new Proxy(v, {})`."
// Seed 1337 (the values are fixed; a property ranges over which guard and which made value). A clone that cannot be made (a function) is not a case: the
// attempt is made and its throw is that value's "cannot be made"; at least one value of the list must clone, so the clause is not vacuous.
import { scope } from "@keel/reactive";
import { isRouteTable, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { defect, isDefect, isSchema, s } from "@keel/schema";
import { isStore, isTransaction, store, transaction } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const Rows = s.object({ n: s.int() });
// `scope(fn, { detached: true })` is the sanctioned test root (k.reactive, Module roots).
const kit = (() => {
  const box: { v?: { board: ReturnType<typeof store<{ n: number }>>; bump: unknown } } = {};
  scope(
    () => {
      const board = store(Rows, { n: 0 }, { id: "ci.board" });
      box.v = { board, bump: transaction(board, "ci.bump", s.object({}), (st) => ({ n: st.n + 1 })) };
    },
    { detached: true },
  );
  if (box.v === undefined) throw new Error("scope body did not run");
  return box.v;
})();
const { board, bump } = kit;
const c = contract("ci", { "ci.a": { path: "/a" } });
const routes = manifest(c, { "ci.a": { component: () => document.createElement("main") } });
const made = (): unknown => {
  try {
    return defect("a defect for the guards");
  } catch (e) {
    return e;
  }
};

interface Case {
  readonly name: string;
  readonly value: unknown;
  readonly guard: (v: unknown) => boolean;
}
const CASES: readonly Case[] = [
  { name: "isDefect", value: made(), guard: (v) => isDefect(v) },
  { name: "isSchema", value: Rows, guard: isSchema },
  { name: "isStore", value: board, guard: isStore },
  { name: "isTransaction", value: bump, guard: isTransaction },
  { name: "isRouteTable", value: routes, guard: isRouteTable },
];
const cloneOf = (v: unknown): { made: true; copy: unknown } | { made: false } => {
  try {
    return { made: true, copy: structuredClone(v) };
  } catch {
    return { made: false };
  }
};
const proxied = (v: unknown): unknown => (typeof v === "object" || typeof v === "function" ? new Proxy(Object(v), {}) : v);

describe("k.identity: a structuredClone and a Proxy fail every guard", () => {
  for (const { name, value, guard } of CASES) {
    it(`${name} is true of the made value, false of structuredClone of it where the clone can be made, and false of new Proxy(v, {})`, () => {
      expect(guard(value)).toBe(true);
      const clone = cloneOf(value);
      if (clone.made) expect(guard(clone.copy)).toBe(false);
      expect(guard(proxied(value))).toBe(false);
    });
  }

  it("property: no guard accepts the structuredClone or the Proxy of any made value, whichever guard and whichever value", () => {
    fc.assert(
      fc.property(fc.constantFrom(...CASES), fc.constantFrom(...CASES), (g, v) => {
        const clone = cloneOf(v.value);
        if (clone.made) expect(g.guard(clone.copy)).toBe(false);
        expect(g.guard(proxied(v.value))).toBe(false);
      }),
      { seed: 1337, numRuns: 50 },
    );
  });

  it("at least one made value can be cloned, so the clause is exercised", () => {
    expect(CASES.some((k) => cloneOf(k.value).made)).toBe(true);
  });
});
