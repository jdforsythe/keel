// Properties of Scope.run (rfc:0014). fast-check seed 1337.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { effect, inspect, scope, signal } from "../src/index.ts";
import type { Scope, Signal } from "../src/index.ts";

const SEED = 1337;

describe("Scope.run properties", () => {
  it("scopes attached later with parent.run (from inside an effect) form a tree; disposing one stops exactly its subtree", () => {
    const treeArb = fc
      .array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 10 })
      .map((ps) => ps.map((p, i) => p % (i + 1)));
    fc.assert(
      fc.property(
        treeArb,
        fc.nat({ max: 1000 }),
        fc.array(fc.integer(), { minLength: 1, maxLength: 5 }),
        (parents, pick, writes) => {
          const n = parents.length + 1;
          const runs = Array.from({ length: n }, () => 0);
          const handles: Scope[] = [];
          const box: { s: Signal<number> | null; attach: Signal<number> | null } = { s: null, attach: null };
          const root = scope(
            () => {
              box.s = signal(Number.NaN);
              box.attach = signal(0);
            },
            { detached: true },
          );
          const s = box.s;
          const attach = box.attach;
          if (s === null || attach === null) throw new Error("unreachable");
          const leaf = (i: number): void => {
            effect(() => {
              s.get();
              runs[i] = (runs[i] ?? 0) + 1;
            });
          };
          handles[0] = root.run(() => scope(() => leaf(0)));
          // One effect attaches every scope; its own reruns must not dispose them.
          root.run(() =>
            effect(
              () => {
                const k = attach.get();
                const p = parents[k - 1];
                const parent = p === undefined ? undefined : handles[p];
                if (parent !== undefined) handles[k] = parent.run(() => scope(() => leaf(k)));
              },
              { writes: [] },
            ),
          );
          for (let k = 1; k < n; k++) attach.set(k);
          const target = pick % n;
          const inside = new Set<number>();
          const walk = (i: number): void => {
            inside.add(i);
            parents.forEach((p, j) => {
              if (p === i) walk(j + 1);
            });
          };
          walk(target);
          handles.forEach((h, i) => {
            expect(h.parent).toBe(i === 0 ? root : handles[parents[i - 1] ?? -1]);
          });
          handles[target]?.dispose();
          const before = [...runs];
          writes.forEach((w, k) => s.set(w * 2 + k + 0.5));
          runs.forEach((r, i) => {
            expect(r - (before[i] ?? 0)).toBe(inside.has(i) ? 0 : writes.length);
          });
          root.dispose();
          expect(inspect().nodes.length).toBe(0);
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("an effect reruns on a write iff it read that signal outside run", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.boolean(), fc.boolean()), { minLength: 1, maxLength: 6 }),
        fc.nat({ max: 1000 }),
        (reads, pick) => {
          const sigs: Signal<number>[] = [];
          let runs = 0;
          const root = scope(
            () => {
              for (let i = 0; i < reads.length; i++) sigs.push(signal(0));
            },
            { detached: true },
          );
          const other = scope(() => {}, { detached: true });
          root.run(() =>
            effect(() => {
              runs++;
              reads.forEach(([read, untracked], i) => {
                const s = sigs[i];
                if (!read || s === undefined) return;
                if (untracked) other.run(() => s.get());
                else s.get();
              });
            }),
          );
          const i = pick % reads.length;
          const [read, untracked] = reads[i] ?? [false, false];
          sigs[i]?.set(1);
          expect(runs).toBe(read && !untracked ? 2 : 1);
          root.dispose();
          other.dispose();
          expect(inspect().nodes.length).toBe(0);
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });
});
