// Example cases for engine behavior not covered by conformance.
import { describe, expect, it } from "vitest";
import { batch, computed, effect, resource, scope, signal } from "../src/index.ts";

const codeOf = (fn: () => void): unknown => {
  try {
    fn();
  } catch (e) {
    return e instanceof Error && "code" in e ? e.code : "non-coded-error";
  }
  return "no-throw";
};
const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe("examples", () => {
  it("E1202: two effects invalidating each other through declared writes", () => {
    expect(
      codeOf(() => {
        scope(() => {
          const a = signal(0);
          const b = signal(0);
          effect(() => b.set(a.get() + 1), { writes: [b] });
          effect(() => a.set(b.get() + 1), { writes: [a] });
        });
      }),
    ).toBe("E1202");
  });

  it("E1202: effect writing a signal that feeds a computed it read", () => {
    expect(
      codeOf(() => {
        scope(() => {
          const s = signal(0);
          const c = computed(() => s.get() * 2);
          effect(() => s.set(c.get() + 1), { writes: [s] });
        });
      }),
    ).toBe("E1202");
  });

  it("E1201: a computed may not write", () => {
    expect(
      codeOf(() => {
        scope(() => {
          const s = signal(0);
          computed(() => {
            s.set(1);
            return 0;
          }).get();
        });
      }),
    ).toBe("E1201");
  });

  it("E1203: resource created outside any scope", () => {
    expect(codeOf(() => void resource(() => Promise.resolve(1)))).toBe("E1203");
  });

  it("thrown errors carry the spec section", () => {
    expect(() => signal(0)).toThrow(expect.objectContaining({ code: "E1203", see: "k.reactive" }));
  });

  it("a scope whose fn throws is disposed", () => {
    let runs = 0;
    let set: (v: number) => void = () => {};
    expect(() =>
      scope(() => {
        const s = signal(0);
        set = (v) => s.set(v);
        effect(() => {
          s.get();
          runs++;
        });
        throw new Error("boom");
      }),
    ).toThrow("boom");
    set(1);
    expect(runs).toBe(1);
  });

  it("an effect's nested primitives are disposed when it reruns", () => {
    let inner = 0;
    scope(() => {
      const outer = signal(0);
      const s = signal(0);
      effect(() => {
        outer.get();
        effect(() => {
          s.get();
          inner++;
        });
      });
      expect(inner).toBe(1);
      outer.set(1);
      expect(inner).toBe(2);
      s.set(1);
      expect(inner).toBe(3);
    });
  });

  it("an effect created inside a batch runs at commit", () => {
    let runs = 0;
    scope(() => {
      batch(() => {
        effect(() => {
          runs++;
        });
        expect(runs).toBe(0);
      });
      expect(runs).toBe(1);
    });
  });

  it("batch returns its callback's value and nested batches commit once", () => {
    let runs = 0;
    scope(() => {
      const s = signal(0);
      effect(() => {
        s.get();
        runs++;
      });
      const out = batch(() => {
        s.set(1);
        batch(() => s.set(2));
        expect(runs).toBe(1);
        return "x";
      });
      expect(out).toBe("x");
      expect(runs).toBe(2);
    });
  });

  it("a branch no longer read is not recomputed", () => {
    let other = 0;
    scope(() => {
      const flag = signal(false);
      const x = signal(1);
      const y = signal(1);
      const expensive = computed(() => {
        other++;
        return y.get() * 2;
      });
      const pick = computed(() => (flag.get() ? x.get() : expensive.get()));
      effect(() => {
        pick.get();
      });
      expect(other).toBe(1);
      batch(() => {
        flag.set(true);
        y.set(2);
      });
      expect(other).toBe(1);
    });
  });

  it("an effect that throws does not strand the other effects of that commit", () => {
    const seen: number[] = [];
    let set: (v: number) => void = () => {};
    scope(() => {
      const s = signal(0);
      set = (v) => s.set(v);
      effect(() => {
        if (s.get() === 1) throw new Error("first");
      });
      effect(() => {
        seen.push(s.get());
      });
    });
    expect(() => set(1)).toThrow("first");
    set(2);
    expect(seen[seen.length - 1]).toBe(2);
  });

  it("an effect that threw runs again on its next change", () => {
    let runs = 0;
    let set: (v: number) => void = () => {};
    scope(() => {
      const s = signal(0);
      set = (v) => s.set(v);
      effect(() => {
        runs++;
        if (s.get() === 1) throw new Error("once");
      });
    });
    expect(() => set(1)).toThrow("once");
    set(2);
    expect(runs).toBe(3);
  });

  it("a computed that threw keeps its error until a source changes, then recomputes", () => {
    let failing = true;
    let runs = 0;
    let read: () => number = () => -1;
    let write: (v: number) => void = () => undefined;
    scope(() => {
      const s = signal(4);
      const c = computed(() => {
        runs++;
        const v = s.get();
        if (failing) throw new Error("not yet");
        return v;
      });
      read = () => c.get();
      write = (v) => s.set(v);
    });
    expect(read).toThrow("not yet");
    failing = false;
    expect(read).toThrow("not yet");
    expect(runs).toBe(1);
    write(5);
    expect(read()).toBe(5);
    expect(runs).toBe(2);
  });

  it("an equal write is not a commit", () => {
    let runs = 0;
    scope(() => {
      const s = signal(3);
      effect(() => {
        s.get();
        runs++;
      });
      s.set(3);
    });
    expect(runs).toBe(1);
  });

  it("resource refetches when a signal its fetcher read changes", async () => {
    const calls: number[] = [];
    let set: (v: number) => void = () => {};
    let read: () => unknown = () => undefined;
    scope(() => {
      const id = signal(1);
      set = (v) => id.set(v);
      const r = resource(() => {
        const v = id.get();
        calls.push(v);
        return Promise.resolve(v * 10);
      });
      read = () => r.get();
    });
    await flush();
    expect(read()).toEqual({ state: "ready", value: 10 });
    set(2);
    expect(read()).toEqual({ state: "loading" });
    await flush();
    expect(read()).toEqual({ state: "ready", value: 20 });
    expect(calls).toEqual([1, 2]);
  });

  it("resource: a synchronous fetcher throw becomes the error state; refetch while loading does not notify", async () => {
    const boom = new Error("sync");
    let n = 0;
    let runs = 0;
    let read: () => unknown = () => undefined;
    let refetch: () => void = () => {};
    scope(() => {
      const r = resource((): Promise<number> => {
        n++;
        if (n === 1) throw boom;
        return new Promise<number>(() => {});
      });
      read = () => r.get();
      refetch = () => r.refetch();
      effect(() => {
        r.get();
        runs++;
      });
    });
    await flush();
    expect(read()).toEqual({ state: "error", error: boom });
    refetch();
    const afterFirst = runs;
    refetch();
    expect(runs).toBe(afterFirst);
    expect(read()).toEqual({ state: "loading" });
  });

  it("a disposed resource ignores late results", async () => {
    let resolve: (v: number) => void = () => {};
    let read: () => unknown = () => undefined;
    const h = scope(() => {
      const r = resource(
        () =>
          new Promise<number>((res) => {
            resolve = res;
          }),
      );
      read = () => r.get();
    });
    h.dispose();
    resolve(1);
    await flush();
    expect(read()).toEqual({ state: "loading" });
  });
});
