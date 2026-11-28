// Disposing an ownership tree whose hooks throw at random. fast-check seed 1337.
// After the root is disposed: every hook ran exactly once, in disposal order (a node's owned nodes in creation order,
// then its own hooks; an effect's hooks belong to a scope it creates first); no node of the tree is live; no effect of
// the tree runs on a later write; the error thrown is the first in disposal order.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { effect, inspect, scope, signal } from "../src/index.ts";

const SEED = 1337;

interface Spec {
  readonly effect: boolean;
  /** Owner index: a smaller node, or -1 for the root. */
  readonly parent: number;
  /** One entry per hook: whether it throws. */
  readonly hooks: readonly boolean[];
}

const treeArb = fc
  .array(
    fc.record({
      effect: fc.boolean(),
      parent: fc.nat({ max: 1000 }),
      hooks: fc.array(fc.boolean(), { maxLength: 3 }),
    }),
    { maxLength: 15 },
  )
  .map((raw): Spec[] => raw.map((s, i) => ({ effect: s.effect, parent: (s.parent % (i + 1)) - 1, hooks: s.hooks })));

const hookId = (node: number, h: number): string => `${node}.${h}`;
const kidsOf = (specs: readonly Spec[], i: number): number[] => specs.flatMap((s, j) => (s.parent === i ? [j] : []));

/** Expected hook order, each with whether it throws, when node `i` (or the root, -1) is disposed. */
const order = (specs: readonly Spec[], i: number): { id: string; throws: boolean }[] => {
  const own = (specs[i]?.hooks ?? []).map((throws, h) => ({ id: hookId(i, h), throws }));
  const below = kidsOf(specs, i).flatMap((k) => order(specs, k));
  return specs[i]?.effect === true ? [...own, ...below] : [...below, ...own];
};

describe("disposing a tree with throwing hooks", () => {
  it("disposes every node once, stops every effect, and rethrows the first error", () => {
    fc.assert(
      fc.property(treeArb, (specs) => {
        const ran: string[] = [];
        const runs = specs.map(() => 0);
        const before = inspect().nodes.length;
        let write: (v: number) => void = () => {};
        const hooksOf = (i: number): (() => void)[] =>
          (specs[i]?.hooks ?? []).map((throws, h) => () => {
            ran.push(hookId(i, h));
            if (throws) throw new Error(hookId(i, h));
          });
        const build = (i: number, read: () => number): void => {
          const kids = kidsOf(specs, i);
          if (specs[i]?.effect === true) {
            effect(() => {
              read();
              runs[i] = (runs[i] ?? 0) + 1;
              const holder = scope(() => {});
              for (const f of hooksOf(i)) holder.onDispose(f);
              for (const k of kids) build(k, read);
            });
          } else {
            const sc = scope(() => {
              for (const k of kids) build(k, read);
            });
            for (const f of hooksOf(i)) sc.onDispose(f);
          }
        };
        const root = scope(
          () => {
            const s = signal(0);
            write = (v) => s.set(v);
            for (const k of kidsOf(specs, -1)) build(k, () => s.get());
          },
          { detached: true },
        );
        expect(runs).toEqual(specs.map((s) => (s.effect ? 1 : 0)));
        let error: unknown = null;
        try {
          root.dispose();
        } catch (e) {
          error = e;
        }
        const expected = order(specs, -1);
        expect(ran).toEqual(expected.map((h) => h.id));
        const first = expected.find((h) => h.throws);
        expect(error instanceof Error ? error.message : null).toBe(first?.id ?? null);
        expect(inspect().nodes.length).toBe(before);
        const after = [...runs];
        write(1);
        expect(runs).toEqual(after);
        // Disposing again does nothing.
        root.dispose();
        expect(ran).toEqual(expected.map((h) => h.id));
      }),
      { seed: SEED, numRuns: 300 },
    );
  });
});
