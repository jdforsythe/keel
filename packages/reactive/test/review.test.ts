// Review fixes D12-D16: disposal while running, E1205, computed equals, inspect, error routing.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { batch, computed, effect, inspect, resource, scope, signal } from "../src/index.ts";
import type { Effect, Resource, Scope } from "../src/index.ts";

const SEED = 1337;

const codeOf = (fn: () => void): unknown => {
  try {
    fn();
  } catch (e) {
    return e instanceof Error && "code" in e ? e.code : "non-coded-error";
  }
  return "no-throw";
};
const flushMicrotasks = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe("D12: disposed while running", () => {
  it("children an effect creates after disposing itself are disposed when it returns", () => {
    let childRuns = 0;
    let set: (v: number) => void = () => {};
    scope(
      () => {
        const s = signal(0);
        set = (v) => s.set(v);
        let self: Effect = { dispose: () => {} };
        // Deferred to the commit so the handle exists when the effect first runs.
        batch(() => {
          self = effect(() => {
            self.dispose();
            effect(() => {
              s.get();
              childRuns++;
            });
          });
        });
      },
      { detached: true },
    );
    const before = childRuns;
    set(1);
    set(2);
    expect(childRuns).toBe(before);
  });

  it("a scope disposed from inside its fn disposes what fn creates afterwards", () => {
    let runs = 0;
    let set: (v: number) => void = () => {};
    scope(
      () => {
        const s = signal(0);
        set = (v) => s.set(v);
        let outer: Scope = { dispose: () => {}, parent: undefined, onDispose: () => {}, run: (f) => f() };
        batch(() => {
          outer = scope(() => {
            // Runs at commit; disposing `outer` disposes this effect and the scope below mid-fn.
            effect(() => {
              scope(() => {
                outer.dispose();
                effect(() => {
                  s.get();
                  runs++;
                });
              });
            });
          });
        });
      },
      { detached: true },
    );
    const before = runs;
    set(1);
    expect(runs).toBe(before);
  });

  it("an effect disposed mid-run may read then write a signal without a false cycle", () => {
    expect(
      codeOf(() =>
        scope(
          () => {
            const s = signal(0);
            let self: Effect = { dispose: () => {} };
            batch(() => {
              self = effect(
                () => {
                  self.dispose();
                  s.set(s.get() + 1);
                },
                { writes: [s] },
              );
            });
          },
          { detached: true },
        ),
      ),
    ).toBe("no-throw");
  });
});

describe("D13: E1205", () => {
  it("reading a disposed computed throws E1205", () => {
    let c: { get(): number } = { get: () => 0 };
    const h = scope(
      () => {
        const s = signal(1);
        c = computed(() => s.get());
        c.get();
      },
      { detached: true },
    );
    h.dispose();
    expect(codeOf(() => void c.get())).toBe("E1205");
  });

  it("a live effect reading a computed from a disposed scope gets E1205 on its next run", () => {
    let c: { get(): number } = { get: () => 0 };
    let set: (v: number) => void = () => {};
    const inner = scope(
      () => {
        c = computed(() => 1);
      },
      { detached: true },
    );
    scope(
      () => {
        const s = signal(0);
        set = (v) => s.set(v);
        effect(() => {
          if (s.get() > 0) c.get();
        });
      },
      { detached: true },
    );
    inner.dispose();
    expect(codeOf(() => set(1))).toBe("E1205");
  });
});

describe("D14: computed equals", () => {
  it("property: with structural equals, a downstream effect runs only when the structure changes (seed 1337)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 })), { maxLength: 20 }),
        (writes) => {
          const seen: Array<{ lo: number; hi: number }> = [];
          const same = (a: { lo: number; hi: number }, b: { lo: number; hi: number }): boolean =>
            a.lo === b.lo && a.hi === b.hi;
          let expectedRuns = 1;
          scope(
            () => {
              const a = signal(0);
              const b = signal(0);
              const range = computed(() => ({ lo: Math.min(a.get(), b.get()), hi: Math.max(a.get(), b.get()) }), {
                equals: same,
              });
              effect(() => {
                seen.push(range.get());
              });
              let prev = { lo: 0, hi: 0 };
              for (const [x, y] of writes) {
                batch(() => {
                  a.set(x);
                  b.set(y);
                });
                const now = { lo: Math.min(x, y), hi: Math.max(x, y) };
                if (!same(prev, now)) expectedRuns++;
                prev = now;
              }
            },
            { detached: true },
          );
          expect(seen.length).toBe(expectedRuns);
          for (let i = 1; i < seen.length; i++) {
            const p = seen[i - 1];
            const q = seen[i];
            if (p && q) expect(same(p, q)).toBe(false);
          }
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("an equal result keeps the previous value's identity", () => {
    scope(
      () => {
        const s = signal(1);
        const c = computed(() => ({ v: s.get() % 2 }), { equals: (a, b) => a.v === b.v });
        const first = c.get();
        s.set(3);
        expect(c.get()).toBe(first);
        s.set(4);
        expect(c.get()).not.toBe(first);
      },
      { detached: true },
    );
  });
});

describe("D15: inspect", () => {
  it("reports kinds and dependency edges of live nodes, and forgets disposed ones", () => {
    const base = Math.max(0, ...inspect().nodes.map((n) => n.id));
    const h = scope(
      () => {
        const s = signal(1);
        const c = computed(() => s.get() + 1);
        effect(() => {
          c.get();
        });
        resource(() => Promise.resolve(s.get()));
      },
      { detached: true },
    );
    const mine = (g: ReturnType<typeof inspect>) => ({
      nodes: g.nodes.filter((n) => n.id > base).map((n) => ({ id: n.id - base, kind: n.kind })),
      edges: g.edges.filter((e) => e.to > base).map((e) => ({ from: e.from - base, to: e.to - base })),
    });
    expect(mine(inspect())).toEqual({
      nodes: [
        { id: 1, kind: "scope" },
        { id: 2, kind: "signal" },
        { id: 3, kind: "computed" },
        { id: 4, kind: "effect" },
        { id: 5, kind: "resource" },
      ],
      edges: [
        { from: 3, to: 4 },
        { from: 2, to: 3 },
        { from: 2, to: 5 },
      ].sort((x, y) => x.to - y.to),
    });
    h.dispose();
    expect(mine(inspect())).toEqual({ nodes: [], edges: [] });
  });

  it("omits edges from sources that were disposed while their readers live on", () => {
    let get: () => number = () => 0;
    let sourceId = -1;
    const a = scope(
      () => {
        const s = signal(0);
        get = () => s.get();
        sourceId = Math.max(...inspect().nodes.map((n) => n.id));
      },
      { detached: true },
    );
    const b = scope(
      () => {
        effect(() => {
          get();
        });
      },
      { detached: true },
    );
    expect(inspect().edges.some((e) => e.from === sourceId)).toBe(true);
    a.dispose();
    expect(inspect().edges.some((e) => e.from === sourceId)).toBe(false);
    b.dispose();
  });

  it("property: edges equal the declared DAG for any random graph (seed 1337)", () => {
    const dagArb = fc.array(fc.uniqueArray(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 3 }), {
      minLength: 1,
      maxLength: 10,
    });
    fc.assert(
      fc.property(dagArb, (raw) => {
        const deps = raw.map((ds, i) => [...new Set(ds.map((x) => x % (i + 1)))]);
        const ids: number[] = [];
        const h = scope(
          () => {
            const src = signal(1);
            const nodes: Array<{ get(): number }> = [src];
            for (const ds of deps) {
              const snapshot = [...nodes];
              nodes.push(computed(() => ds.reduce((s, k) => s + (snapshot[k]?.get() ?? 0), 0)));
            }
            effect(() => {
              for (const n of nodes) n.get();
            });
          },
          { detached: true },
        );
        const g = inspect();
        const top = g.nodes[g.nodes.length - 1];
        const effectId = top?.id ?? -1;
        // Nodes of this scope: [scope, src, c1..cn, effect], consecutive ids.
        const first = effectId - deps.length - 2;
        for (let k = 0; k <= deps.length; k++) ids.push(first + 1 + k);
        const expected = new Set<string>();
        deps.forEach((ds, i) => {
          for (const d of ds) expected.add(`${ids[d]}->${ids[i + 1]}`);
        });
        for (const id of ids) expected.add(`${id}->${effectId}`);
        const actual = new Set(g.edges.filter((e) => e.to >= first).map((e) => `${e.from}->${e.to}`));
        expect(actual).toEqual(expected);
        h.dispose();
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});

describe("D16: errors are not masked or lost", () => {
  it("batch rethrows fn's error even when the commit also throws, and the commit still runs", () => {
    const seen: number[] = [];
    let thrown: unknown;
    scope(
      () => {
        const s = signal(0);
        effect(() => {
          if (s.get() === 1) throw new Error("from effect");
        });
        effect(() => {
          seen.push(s.get());
        });
        try {
          batch(() => {
            s.set(1);
            throw new Error("from fn");
          });
        } catch (e) {
          thrown = e;
        }
      },
      { detached: true },
    );
    expect(thrown).toEqual(new Error("from fn"));
    expect(seen).toEqual([0, 1]);
  });

  it("a commit with several throwing effects runs them all and rethrows the first", () => {
    const ran: string[] = [];
    let set: (v: number) => void = () => {};
    scope(
      () => {
        const s = signal(0);
        set = (v) => s.set(v);
        for (const name of ["a", "b", "c"]) {
          effect(() => {
            if (s.get() === 0) return;
            ran.push(name);
            if (name !== "c") throw new Error(name);
          });
        }
      },
      { detached: true },
    );
    expect(() => set(1)).toThrow("a");
    expect(ran).toEqual(["a", "b", "c"]);
  });

  it("a reader throwing on ready turns the resource into error via loading, with no unhandled rejection", async () => {
    const boom = new Error("reader");
    const states: string[] = [];
    let read: () => unknown = () => undefined;
    scope(
      () => {
        const r = resource(() => Promise.resolve(1));
        read = () => r.get();
        effect(() => {
          const st = r.get();
          states.push(st.state);
          if (st.state === "ready") throw boom;
        });
      },
      { detached: true },
    );
    await flushMicrotasks();
    expect(read()).toEqual({ state: "error", error: boom });
    expect(states).toEqual(["loading", "ready", "loading", "error"]);
  });

  it("refetch inside an effect is E1201 unless the resource is declared in writes", () => {
    expect(
      codeOf(() =>
        scope(
          () => {
            const r = resource(() => Promise.resolve(1));
            effect(() => r.refetch());
          },
          { detached: true },
        ),
      ),
    ).toBe("E1201");
    expect(
      codeOf(() =>
        scope(
          () => {
            const r: Resource<number> = resource(() => Promise.resolve(1));
            effect(() => r.refetch(), { writes: [r] });
          },
          { detached: true },
        ),
      ),
    ).toBe("no-throw");
  });

  it("a resource is not pulled by reads: inside a batch it reruns only at commit", async () => {
    let calls = 0;
    let r: Resource<number> = { get: () => ({ state: "loading" }), refetch: () => {} };
    let set: (v: number) => void = () => {};
    scope(
      () => {
        const id = signal(1);
        set = (v) => id.set(v);
        r = resource(() => {
          calls++;
          return Promise.resolve(id.get());
        });
      },
      { detached: true },
    );
    await flushMicrotasks();
    batch(() => {
      set(2);
      expect(r.get()).toEqual({ state: "ready", value: 1 });
      expect(calls).toBe(1);
    });
    expect(r.get()).toEqual({ state: "loading" });
    expect(calls).toBe(2);
  });

  it("refetch inside a computed is E1201", () => {
    expect(
      codeOf(() =>
        scope(
          () => {
            const r = resource(() => Promise.resolve(1));
            computed(() => {
              r.refetch();
              return 0;
            }).get();
          },
          { detached: true },
        ),
      ),
    ).toBe("E1201");
  });
});
