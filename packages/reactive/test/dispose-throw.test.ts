// A throwing dispose hook never stops a disposal: every owned node is disposed, every hook runs, and the first error
// in disposal order is rethrown after the rest. A rerun whose own run throws after a hook threw rethrows the hook's.
import { describe, expect, it } from "vitest";
import { effect, scope, signal } from "../src/index.ts";

const messageOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return "no-throw";
};

describe("a throwing dispose hook", () => {
  it("does not leave a later sibling alive when the owning effect reruns", () => {
    let runsB = 0;
    let setA: (v: number) => void = () => {};
    let setB: (v: number) => void = () => {};
    const sc = scope(
      () => {
        const a = signal(0);
        const b = signal(0);
        setA = (v) => a.set(v);
        setB = (v) => b.set(v);
        effect(() => {
          a.get();
          scope(() => {}).onDispose(() => {
            throw new Error("hook");
          });
          effect(() => {
            b.get();
            runsB++;
          });
        });
      },
      { detached: true },
    );
    expect(runsB).toBe(1);
    expect(messageOf(() => setA(1))).toBe("hook");
    // The rerun created B'; the first B is disposed.
    expect(runsB).toBe(2);
    setB(1);
    expect(runsB).toBe(3);
    expect(messageOf(() => sc.dispose())).toBe("hook");
    setB(2);
    expect(runsB).toBe(3);
  });

  it("runs every hook of a node and rethrows the first", () => {
    const ran: string[] = [];
    const sc = scope(() => {}, { detached: true });
    sc.onDispose(() => {
      ran.push("a");
      throw new Error("a");
    });
    sc.onDispose(() => {
      ran.push("b");
      throw new Error("b");
    });
    sc.onDispose(() => {
      ran.push("c");
    });
    expect(messageOf(() => sc.dispose())).toBe("a");
    expect(ran).toEqual(["a", "b", "c"]);
  });

  it("rethrows the hook's error when the rerun it belongs to then throws", () => {
    let set: (v: number) => void = () => {};
    const sc = scope(
      () => {
        const s = signal(0);
        set = (v) => s.set(v);
        effect(() => {
          if (s.get() > 0) throw new Error("run");
          scope(() => {}).onDispose(() => {
            throw new Error("hook");
          });
        });
      },
      { detached: true },
    );
    expect(messageOf(() => set(1))).toBe("hook");
    sc.dispose();
  });

  it("rethrows the error of a scope's fn, not a hook's thrown while disposing it", () => {
    expect(
      messageOf(() =>
        scope(
          () => {
            scope(() => {}).onDispose(() => {
              throw new Error("hook");
            });
            throw new Error("fn");
          },
          { detached: true },
        ),
      ),
    ).toBe("fn");
  });
});

describe("scope.run", () => {
  it("rethrows the error of its fn, not a hook's thrown while freeing what the fn created after a dispose", () => {
    const sc = scope(() => {}, { detached: true });
    expect(
      messageOf(() =>
        sc.run(() => {
          sc.dispose();
          scope(() => {}).onDispose(() => {
            throw new Error("hook");
          });
          throw new Error("fn");
        }),
      ),
    ).toBe("fn");
  });

  it("rethrows a hook's error when its fn returns", () => {
    const sc = scope(() => {}, { detached: true });
    expect(
      messageOf(() =>
        sc.run(() => {
          sc.dispose();
          scope(() => {}).onDispose(() => {
            throw new Error("hook");
          });
        }),
      ),
    ).toBe("hook");
  });
});
