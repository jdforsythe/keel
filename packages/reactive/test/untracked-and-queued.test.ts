// Untracked reads of a throwing computed, coded errors inside a computed, and effects disposed while queued.
import { describe, expect, it } from "vitest";
import { batch, computed, effect, scope, signal } from "../src/index.ts";
import type { Effect } from "../src/index.ts";

const outcomeOf = (fn: () => unknown): string => {
  try {
    return `v${String(fn())}`;
  } catch (e) {
    if (e instanceof Error && "code" in e && typeof e.code === "string") return e.code;
    return e instanceof Error ? e.message : String(e);
  }
};

describe("an untracked read of a throwing computed", () => {
  it("scope.run throws the computed's error to its caller and subscribes nothing", () => {
    const seen: string[] = [];
    let set: (v: number) => void = () => {};
    let runs = 0;
    const sc = scope(() => {
      const s = signal(1);
      set = (v) => s.set(v);
      const c = computed(() => {
        const v = s.get();
        if (v % 2 === 1) throw new Error(`odd ${v}`);
        return v;
      });
      const home = scope(() => {});
      effect(() => {
        runs++;
        seen.push(outcomeOf(() => home.run(() => c.get())));
      });
    });
    expect(seen).toEqual(["odd 1"]);
    set(2);
    set(3);
    expect(runs).toBe(1);
    sc.dispose();
  });

  it("a detached scope's fn throws the computed's error to its creator and subscribes nothing", () => {
    const seen: string[] = [];
    let set: (v: number) => void = () => {};
    let runs = 0;
    const sc = scope(() => {
      const s = signal(1);
      set = (v) => s.set(v);
      const c = computed(() => {
        const v = s.get();
        if (v % 2 === 1) throw new Error(`odd ${v}`);
        return v;
      });
      effect(() => {
        runs++;
        seen.push(
          outcomeOf(() => {
            let out = 0;
            scope(
              () => {
                out = c.get();
              },
              { detached: true },
            );
            return out;
          }),
        );
      });
    });
    expect(seen).toEqual(["odd 1"]);
    set(2);
    expect(runs).toBe(1);
    sc.dispose();
  });

  it("the same computed read tracked after an untracked read still reruns its reader", () => {
    const seen: string[] = [];
    let set: (v: number) => void = () => {};
    const sc = scope(() => {
      const s = signal(1);
      set = (v) => s.set(v);
      const c = computed(() => {
        const v = s.get();
        if (v % 2 === 1) throw new Error(`odd ${v}`);
        return v;
      });
      const home = scope(() => {});
      effect(() => {
        outcomeOf(() => home.run(() => c.get()));
        seen.push(outcomeOf(() => c.get()));
      });
    });
    set(2);
    set(3);
    expect(seen).toEqual(["odd 1", "v2", "odd 3"]);
    sc.dispose();
  });
});

describe("a coded error inside a computed", () => {
  it("E1201 from a write in a computed is its outcome: the reader's catch gets it, and a later change retries", () => {
    const seen: string[] = [];
    let set: (v: number) => void = () => {};
    const sc = scope(() => {
      const s = signal(0);
      const other = signal(0);
      set = (v) => s.set(v);
      const c = computed(() => {
        const v = s.get();
        if (v === 1) other.set(v);
        return v;
      });
      effect(() => {
        seen.push(outcomeOf(() => c.get()));
      });
    });
    set(1);
    set(2);
    expect(seen).toEqual(["v0", "E1201", "v2"]);
    sc.dispose();
  });

  it("E1202 from a self-read is its outcome too, reaching a reader through another computed", () => {
    const seen: string[] = [];
    let set: (v: number) => void = () => {};
    const sc = scope(() => {
      const s = signal(0);
      set = (v) => s.set(v);
      const box: { c: { get(): number } } = { c: { get: () => 0 } };
      box.c = computed(() => (s.get() === 1 ? box.c.get() : s.get()));
      const d = computed(() => box.c.get() + 10);
      effect(() => {
        seen.push(outcomeOf(() => d.get()));
      });
    });
    set(1);
    set(2);
    expect(seen).toEqual(["v10", "E1202", "v12"]);
    sc.dispose();
  });
});

describe("an effect disposed while queued", () => {
  it("does not run when an earlier effect of the same commit disposes it", () => {
    let set: (v: number) => void = () => {};
    let bRuns = 0;
    const later: { b: Effect | null } = { b: null };
    const sc = scope(() => {
      const s = signal(0);
      set = (v) => s.set(v);
      effect(() => {
        if (s.get() === 1) later.b?.dispose();
      });
      later.b = effect(() => {
        s.get();
        bRuns++;
      });
    });
    expect(bRuns).toBe(1);
    set(1);
    set(2);
    expect(bRuns).toBe(1);
    sc.dispose();
  });

  it("does not run when its scope is disposed inside the batch that queued it", () => {
    let runs = 0;
    let set: (v: number) => void = () => {};
    const outer = scope(() => {
      const s = signal(0);
      const inner = scope(() => {
        effect(() => {
          s.get();
          runs++;
        });
      });
      set = (v) =>
        batch(() => {
          s.set(v);
          inner.dispose();
        });
    });
    set(1);
    expect(runs).toBe(1);
    outer.dispose();
  });

  it("a disposed queued effect that would throw neither runs nor reaches onError", () => {
    const errors: unknown[] = [];
    let set: (v: number) => void = () => {};
    const sc = scope(
      () => {
        const s = signal(0);
        set = (v) => s.set(v);
        const victim: { e: Effect | null } = { e: null };
        effect(() => {
          if (s.get() === 1) victim.e?.dispose();
        });
        victim.e = effect(() => {
          if (s.get() === 1) throw new Error("should not run");
        });
      },
      { onError: (e) => errors.push(e) },
    );
    set(1);
    expect(errors).toEqual([]);
    sc.dispose();
  });
});
