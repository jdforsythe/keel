// Spec: k.reactive, clause "A computed that threw and then returns its value from before the throw reruns its readers (also with `equals`, through a computed chain, and for a `resource` fetcher reading it)."
// Spec: k.reactive, clause "A throwing computed runs at most once per commit however many readers and dependent computeds read it, and every reader's `get()` throws that one error."
// Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computed, effect, resource, scope, signal } from "@keel/reactive";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const distinct = fc
  .tuple(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }))
  .filter(([a, b]) => a !== b);

function mk(initial: number) {
  let s: ReturnType<typeof signal<number>> | undefined;
  scope(
    () => {
      s = signal(initial);
    },
    { detached: true },
  );
  if (!s) throw new Error("unreachable");
  return s;
}

describe("k.reactive: a computed that threw and recovers", () => {
  it("a computed that threw and then returns its value from before the throw reruns its readers", () => {
    fc.assert(
      fc.property(distinct, ([good, bad]) => {
        const s = mk(good);
        const seen: (number | string)[] = [];
        scope(
          () => {
            const c = computed(() => {
              if (s.get() === bad) throw new Error("boom");
              return s.get();
            });
            effect(() => {
              try {
                seen.push(c.get());
              } catch {
                seen.push("err");
              }
            });
          },
          { detached: true },
        );
        s.set(bad);
        s.set(good);
        expect(seen).toEqual([good, "err", good]);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("the same recovery reruns readers when the computed has a custom equals", () => {
    fc.assert(
      fc.property(distinct, ([good, bad]) => {
        const s = mk(good);
        const seen: (number | string)[] = [];
        scope(
          () => {
            const c = computed(
              () => {
                if (s.get() === bad) throw new Error("boom");
                return s.get();
              },
              { equals: (a, b) => a === b },
            );
            effect(() => {
              try {
                seen.push(c.get());
              } catch {
                seen.push("err");
              }
            });
          },
          { detached: true },
        );
        s.set(bad);
        s.set(good);
        expect(seen).toEqual([good, "err", good]);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("the same recovery reruns readers of a computed chain", () => {
    fc.assert(
      fc.property(distinct, ([good, bad]) => {
        const s = mk(good);
        const seen: (number | string)[] = [];
        scope(
          () => {
            const c = computed(() => {
              if (s.get() === bad) throw new Error("boom");
              return s.get();
            });
            const c2 = computed(() => c.get() * 2);
            effect(() => {
              try {
                seen.push(c2.get());
              } catch {
                seen.push("err");
              }
            });
          },
          { detached: true },
        );
        s.set(bad);
        s.set(good);
        expect(seen).toEqual([good * 2, "err", good * 2]);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("a resource whose fetcher reads the computed is ready again after recovery", async () => {
    const s = mk(1);
    let state: () => { state: string; value?: number; error?: unknown } = () => ({ state: "" });
    scope(
      () => {
        const c = computed(() => {
          if (s.get() === 2) throw new Error("boom");
          return s.get();
        });
        const r = resource(() => Promise.resolve(c.get()));
        state = () => r.get();
      },
      { detached: true },
    );
    await flush();
    expect(state()).toEqual({ state: "ready", value: 1 });
    s.set(2);
    await flush();
    expect(state().state).toBe("error");
    s.set(1);
    await flush();
    expect(state()).toEqual({ state: "ready", value: 1 });
  });
});

describe("k.reactive: a throwing computed runs once per commit", () => {
  it("a throwing computed runs at most once per commit however many readers and dependent computeds read it, and every reader's get() throws that one error", () => {
    fc.assert(
      fc.property(distinct, ([good, bad]) => {
        const s = mk(good);
        let runs = 0;
        const boom = new Error("boom");
        const caught: unknown[] = [];
        scope(
          () => {
            const c = computed(() => {
              runs++;
              if (s.get() === bad) throw boom;
              return s.get();
            });
            const d = computed(() => c.get() + 1);
            const read = (f: () => number) => () => {
              try {
                f();
              } catch (e) {
                caught.push(e);
              }
            };
            effect(read(() => c.get()));
            effect(read(() => c.get()));
            effect(read(() => c.get()));
            effect(read(() => d.get()));
          },
          { detached: true },
        );
        expect(runs).toBe(1);
        s.set(bad);
        expect(runs).toBe(2);
        expect(caught).toHaveLength(4);
        for (const e of caught) expect(e).toBe(boom);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("a further read with no source change does not run the computed again and throws the same error", () => {
    fc.assert(
      fc.property(distinct, ([good, bad]) => {
        const s = mk(good);
        let runs = 0;
        const boom = new Error("boom");
        let read: () => number = () => 0;
        scope(
          () => {
            const c = computed(() => {
              runs++;
              if (s.get() === bad) throw boom;
              return s.get();
            });
            read = () => c.get();
            effect(() => {
              try {
                c.get();
              } catch {
                // caught
              }
            });
          },
          { detached: true },
        );
        s.set(bad);
        const before = runs;
        let first: unknown;
        let second: unknown;
        try {
          read();
        } catch (e) {
          first = e;
        }
        try {
          read();
        } catch (e) {
          second = e;
        }
        expect(first).toBe(boom);
        expect(second).toBe(boom);
        expect(runs).toBe(before);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
