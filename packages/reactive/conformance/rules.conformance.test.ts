// Spec: k.reactive, rules E1201, E1202, E1203.
import { describe, expect, it } from "vitest";
import { signal, computed, effect, scope } from "@keel/reactive";

const codeOf = (fn: () => void): unknown => {
  try {
    fn();
  } catch (e) {
    if (e instanceof Error && "code" in e) return e.code;
    return "non-coded-error";
  }
  return "no-throw";
};

describe("k.reactive: rules", () => {
  it("E1201: effect writing to a signal not in its declared writes", () => {
    expect(
      codeOf(() => {
        scope(() => {
          const other = signal(0);
          effect(
            () => {
              other.set(1);
            },
            { writes: [] },
          );
        });
      }),
    ).toBe("E1201");
  });

  it("E1201: write to a signal declared by a different effect is still rejected", () => {
    expect(
      codeOf(() => {
        scope(() => {
          const a = signal(0);
          const b = signal(0);
          effect(
            () => {
              b.set(1);
            },
            { writes: [a] },
          );
        });
      }),
    ).toBe("E1201");
  });

  it("E1201 is not raised for a declared write", () => {
    expect(
      codeOf(() => {
        scope(() => {
          const a = signal(0);
          effect(
            () => {
              a.set(1);
            },
            { writes: [a] },
          );
        });
      }),
    ).toBe("no-throw");
  });

  it("E1202: computed dependency cycle", () => {
    expect(
      codeOf(() => {
        scope(() => {
          const holder: { b?: { get(): number } } = {};
          const a = computed((): number => holder.b?.get() ?? 0);
          const b = computed((): number => a.get() + 1);
          holder.b = b;
          b.get();
        });
      }),
    ).toBe("E1202");
  });

  it("E1202: effect that reads and writes its own signal in a loop", () => {
    expect(
      codeOf(() => {
        scope(() => {
          const s = signal(0);
          effect(
            () => {
              s.set(s.get() + 1);
            },
            { writes: [s] },
          );
        });
      }),
    ).toBe("E1202");
  });

  it("E1203: signal created outside any scope", () => {
    expect(codeOf(() => void signal(0))).toBe("E1203");
  });

  it("E1203: computed, effect created outside any scope", () => {
    expect(codeOf(() => void computed(() => 1))).toBe("E1203");
    expect(codeOf(() => void effect(() => {}))).toBe("E1203");
  });

  it("E1203: primitive created after its scope has run (async, outside scope)", async () => {
    scope(() => {});
    await Promise.resolve();
    expect(codeOf(() => void signal(0))).toBe("E1203");
  });

  it("creation inside scope does not throw E1203", () => {
    expect(codeOf(() => void scope(() => void signal(0)))).toBe("no-throw");
  });
});
