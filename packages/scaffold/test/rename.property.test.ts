// Property: over generated trees, `rename A B` then `rename B A` is the identity (k.scaffold conformance 2),
// and after the forward rename no source file still references the old name.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, apply, lower, snap, tree, upper } from "./helpers.ts";

const word = (s: string): RegExp => new RegExp(`(?<![A-Za-z0-9_$])${s.replace(/\./g, "\\.")}(?![A-Za-z0-9_$])`);

describe("rename", () => {
  it("component: rename then reverse rename restores a byte-identical tree", () => {
    fc.assert(
      fc.property(tree, upper, (t, to) => {
        fc.pre(!t.components.includes(to));
        const from = t.components[0] ?? "";
        const mid = apply("rename", { kind: "component", from, to }, t.files);
        for (const [p, c] of mid) expect(word(from).test(p) || word(from).test(c), p).toBe(false);
        expect(snap(apply("rename", { kind: "component", from: to, to: from }, mid))).toBe(snap(t.files));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("store: rename then reverse rename restores a byte-identical tree", () => {
    fc.assert(
      fc.property(tree, lower, (t, leaf) => {
        const from = t.stores[0] ?? "";
        const to = `${from.split(".")[0]}.${leaf}`;
        fc.pre(![...t.stores, ...t.routes].some((id) => id.endsWith(`.${leaf}`)) && !t.modules.includes(leaf));
        const mid = apply("rename", { kind: "store", from, to }, t.files);
        for (const [p, c] of mid) expect(word(from).test(c), p).toBe(false);
        expect(snap(apply("rename", { kind: "store", from: to, to: from }, mid))).toBe(snap(t.files));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("route: rename then reverse rename restores a byte-identical tree", () => {
    fc.assert(
      fc.property(tree, lower, (t, leaf) => {
        const from = t.routes[0] ?? "";
        const to = `${from.split(".")[0]}.${leaf}`;
        fc.pre(![...t.stores, ...t.routes].some((id) => id.endsWith(`.${leaf}`)) && !t.modules.includes(leaf));
        const mid = apply("rename", { kind: "route", from, to }, t.files);
        for (const [p, c] of mid) expect(word(from).test(c), p).toBe(false);
        expect(snap(apply("rename", { kind: "route", from: to, to: from }, mid))).toBe(snap(t.files));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("schema: renaming a store's state schema and back restores a byte-identical tree", () => {
    fc.assert(
      fc.property(tree, upper, (t, to) => {
        const leaf = (t.stores[0] ?? "").split(".")[1] ?? "";
        const from = `${leaf.charAt(0).toUpperCase()}${leaf.slice(1)}State`;
        fc.pre(!t.components.includes(to));
        const mid = apply("rename", { kind: "schema", from, to }, t.files);
        expect(snap(apply("rename", { kind: "schema", from: to, to: from }, mid))).toBe(snap(t.files));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
