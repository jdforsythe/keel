// A throwing `equals` and a throwing dispose hook never leave a node stuck. fast-check seed 1337.
// After every commit the reader saw the model's outcome and ran exactly when that outcome changed; a hook's throw
// surfaces from the commit that disposed it and the next commit still reaches every reader.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computed, effect, scope, signal } from "../src/index.ts";

const SEED = 1337;

interface Item {
  readonly id: number;
}
type Outcome = { readonly err: false; readonly id: number } | { readonly err: true };

/** `id` null is an item whose `id` throws, the way `null.id` does for `(a, b) => a.id === b.id`. */
const itemOf = (id: number | null): Item =>
  id === null
    ? {
        get id(): number {
          throw new TypeError("no id");
        },
      }
    : { id };

const readId = (item: Item): number | null => {
  try {
    return item.id;
  } catch {
    return null;
  }
};

const writesArb = fc.array(fc.option(fc.nat({ max: 3 }), { nil: null, freq: 3 }), { maxLength: 25 });

describe("throw guards", () => {
  it("a throwing equals is the computed's outcome, direct or through a chain, and later writes rerun the reader", () => {
    fc.assert(
      fc.property(writesArb, fc.boolean(), (writes, chained) => {
        const seen: Outcome[] = [];
        let set: (v: Item) => void = () => {};
        const sc = scope(() => {
          const s = signal(itemOf(0));
          set = (v) => s.set(v);
          const c = computed(() => s.get(), { equals: (a, b) => a.id === b.id });
          const id = computed(() => c.get().id);
          effect(() => {
            try {
              seen.push({ err: false, id: chained ? id.get() : c.get().id });
            } catch {
              seen.push({ err: true });
            }
          });
        });
        // Model: `c` keeps its last value and whether it threw; `equals` runs only between two values.
        let kept: Item = itemOf(0);
        let threw = false;
        let out: Outcome = { err: false, id: 0 };
        for (const w of writes) {
          const next = itemOf(w);
          const before = seen.length;
          set(next);
          let changed = true;
          if (threw) {
            threw = false;
            kept = next;
          } else if (w === null || readId(kept) === null) threw = true;
          else if (readId(kept) === w) changed = false;
          else kept = next;
          const k = readId(kept);
          const nextOut: Outcome = threw || k === null ? { err: true } : { err: false, id: k };
          // Through `id` (default equals) the reader reruns unless two values in a row are the same id.
          const sameValue = !out.err && !nextOut.err && out.id === nextOut.id;
          const rerun = changed && !(chained && sameValue);
          expect(seen.length - before).toBe(rerun ? 1 : 0);
          expect(seen.at(-1)).toEqual(nextOut);
          out = nextOut;
        }
        sc.dispose();
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("a throwing dispose hook surfaces from its commit and no reader is left behind", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.nat({ max: 5 }), fc.boolean()), { maxLength: 20 }),
        fc.boolean(),
        (steps, deep) => {
          const seen: number[] = [];
          let arm = false;
          let set: (v: number) => void = () => {};
          const sc = scope(() => {
            const s = signal(0);
            set = (v) => s.set(v);
            const c = computed(() => {
              const v = s.get();
              if (arm) {
                arm = false;
                scope(() => {}).onDispose(() => {
                  throw new Error("hook");
                });
              }
              return v;
            });
            const top = deep ? computed(() => c.get() + 100) : computed(() => c.get());
            effect(() => {
              seen.push(top.get());
            });
          });
          const offset = deep ? 100 : 0;
          let current = 0;
          let armed = false;
          for (const [v, armNext] of steps) {
            arm = armNext;
            let error: unknown = null;
            try {
              set(v);
            } catch (e) {
              error = e;
            }
            const ran = v !== current;
            // The hook armed by the last run is disposed by this run, and throws from this commit.
            expect(error instanceof Error ? error.message : null).toBe(ran && armed ? "hook" : null);
            expect(seen.at(-1)).toBe(ran ? v + offset : current + offset);
            if (ran) {
              armed = armNext;
              current = v;
            } else arm = false;
          }
          // A hook armed by the last run throws from the scope's own dispose.
          if (armed) expect(() => sc.dispose()).toThrow("hook");
          else sc.dispose();
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });
});
