// A throw anywhere in a computed (its fn, its `equals`, a dispose hook of what its last run created) is its outcome
// or its reader's, and never leaves a node stuck: later writes still rerun every reader.
import { describe, expect, it } from "vitest";
import { batch, computed, effect, scope, signal } from "../src/index.ts";
import type { Computed } from "../src/index.ts";

interface Item {
  readonly id: number;
}

const messageOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return "no-throw";
};

describe("a throwing equals", () => {
  it("is the computed's outcome: the reader's own catch sees it and later writes still rerun the reader", () => {
    const seen: string[] = [];
    let set: (v: Item) => void = () => {};
    // An item whose `id` throws, like `null.id` for `equals: (a, b) => a.id === b.id` after `set(null)`.
    const broken: Item = {
      get id(): number {
        throw new TypeError("no id");
      },
    };
    const sc = scope(() => {
      const s = signal<Item>({ id: 1 });
      set = (v) => s.set(v);
      const c = computed(() => s.get(), { equals: (a, b) => a.id === b.id });
      effect(() => {
        try {
          seen.push(`v${String(c.get().id)}`);
        } catch (e) {
          seen.push(e instanceof Error ? e.message : "other");
        }
      });
    });
    set(broken);
    expect(seen).toEqual(["v1", "no id"]);
    set({ id: 2 });
    set({ id: 3 });
    expect(seen).toEqual(["v1", "no id", "v2", "v3"]);
    sc.dispose();
  });

  it("a throw from equals reaches the reader's catch, and the next change reruns the reader", () => {
    const seen: string[] = [];
    let set: (v: Item | null) => void = () => {};
    const sc = scope(() => {
      const s = signal<Item | null>({ id: 1 });
      set = (v) => s.set(v);
      const c = computed(() => s.get(), {
        equals: (a, b) => {
          if (a === null || b === null) throw new Error("equals on null");
          return a.id === b.id;
        },
      });
      effect(() => {
        try {
          seen.push(`v${String(c.get()?.id)}`);
        } catch (e) {
          seen.push(e instanceof Error ? e.message : "other");
        }
      });
    });
    set(null);
    expect(seen).toEqual(["v1", "equals on null"]);
    set({ id: 2 });
    expect(seen).toEqual(["v1", "equals on null", "v2"]);
    set({ id: 3 });
    expect(seen).toEqual(["v1", "equals on null", "v2", "v3"]);
    sc.dispose();
  });

  it("a throw from equals in a computed pulled through another computed reaches the effect, which reruns later", () => {
    const seen: string[] = [];
    let set: (v: Item | null) => void = () => {};
    const sc = scope(() => {
      const s = signal<Item | null>({ id: 1 });
      set = (v) => s.set(v);
      const a = computed(() => s.get(), {
        equals: (x, y) => {
          if (x === null || y === null) throw new Error("equals on null");
          return x.id === y.id;
        },
      });
      const b = computed(() => a.get()?.id ?? -1);
      effect(() => {
        try {
          seen.push(`v${String(b.get())}`);
        } catch (e) {
          seen.push(e instanceof Error ? e.message : "other");
        }
      });
    });
    set(null);
    expect(seen).toEqual(["v1", "equals on null"]);
    set({ id: 2 });
    set({ id: 3 });
    expect(seen).toEqual(["v1", "equals on null", "v2", "v3"]);
    sc.dispose();
  });
});

describe("a throw while bringing a source up to date", () => {
  it("does not leave an effect in Check: it surfaces from the commit and later writes rerun the effect", () => {
    const seen: number[] = [];
    let set: (v: number) => void = () => {};
    let hooked = false;
    const sc = scope(() => {
      const s = signal(0);
      set = (v) => s.set(v);
      // Its first run creates a scope whose dispose hook throws once; the rerun disposes it.
      const c = computed(() => {
        const v = s.get();
        if (!hooked) {
          hooked = true;
          scope(() => {}).onDispose(() => {
            throw new Error("hook");
          });
        }
        return v;
      });
      const d = computed(() => c.get() * 10);
      effect(() => {
        seen.push(d.get());
      });
    });
    expect(seen).toEqual([0]);
    expect(messageOf(() => set(1))).toBe("hook");
    set(2);
    expect(seen.at(-1)).toBe(20);
    set(3);
    expect(seen.at(-1)).toBe(30);
    sc.dispose();
  });

  it("in a batch: the effect is not stuck either", () => {
    const seen: number[] = [];
    let set: (v: number) => void = () => {};
    let hooked = false;
    const sc = scope(() => {
      const s = signal(0);
      set = (v) => s.set(v);
      const c = computed(() => {
        const v = s.get();
        if (!hooked) {
          hooked = true;
          scope(() => {}).onDispose(() => {
            throw new Error("hook");
          });
        }
        return v;
      });
      effect(() => {
        seen.push(c.get());
      });
    });
    expect(messageOf(() => batch(() => set(1)))).toBe("hook");
    set(2);
    expect(seen.at(-1)).toBe(2);
    sc.dispose();
  });
});

describe("dispose", () => {
  // A full collection: the flag makes `gc` available to a fresh context.
  // Calls `name` on a Node built-in module (this package has no Node types, so the module is `unknown` here).
  const call = async (specifier: string, name: string, arg: string): Promise<unknown> => {
    const mod: unknown = await import(specifier);
    if (typeof mod !== "object" || mod === null || !(name in mod)) return undefined;
    const f: unknown = Reflect.get(mod, name);
    return typeof f === "function" ? Reflect.apply(f, mod, [arg]) : undefined;
  };
  // A full collection: the flag makes `gc` available to a fresh context.
  const collect = async (): Promise<void> => {
    await call("node:v8", "setFlagsFromString", "--expose-gc");
    const gc = await call("node:vm", "runInNewContext", "gc");
    // A WeakRef target is held until the current job ends.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (typeof gc === "function") gc();
  };

  it("a held handle of a disposed computed keeps neither its error nor its value reachable", async () => {
    // Built in a function so no local of the test holds the error or the value; the computeds make them.
    const made = (): { held: Computed<object>[]; refs: WeakRef<object>[]; sc: { dispose(): void } } => {
      const held: Computed<object>[] = [];
      const refs: WeakRef<object>[] = [];
      const sc = scope(() => {
        const failing = computed((): object => {
          throw new Error("kept");
        });
        const ok = computed(() => ({ big: "value" }));
        try {
          failing.get();
        } catch (e) {
          if (e instanceof Error) refs.push(new WeakRef(e));
        }
        refs.push(new WeakRef(ok.get()));
        held.push(failing, ok);
      });
      return { held, refs, sc };
    };
    const { held, refs, sc } = made();
    sc.dispose();
    await collect();
    expect(refs.map((r) => r.deref())).toEqual([undefined, undefined]);
    expect(held.map((c) => messageOf(() => c.get()).slice(0, 5))).toEqual(["E1205", "E1205"]);
  });
});
