// Spec: k.reactive API "scope.run(fn) runs fn with that scope as owner, untracked (writes are still checked), and
// returns its value"; Rules E1206 "run on a disposed scope"; Conformance "nodes created inside scope.run(fn) are
// disposed with that scope; run on a disposed scope throws E1206; reads inside run do not register dependencies of
// an enclosing effect".
import { describe, expect, it } from "vitest";
import { effect, owner, scope, signal } from "@keel/reactive";
import type { Scope } from "@keel/reactive";

function mk() {
  let s: ReturnType<typeof signal<number>> | undefined;
  scope(() => {
    s = signal(0);
  });
  if (!s) throw new Error("unreachable");
  return s;
}

function errorOf(fn: () => void): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe("k.reactive: scope.run", () => {
  it("run returns fn's value", () => {
    const h = scope(() => {});
    expect(h.run(() => 42)).toBe(42);
    const obj = {};
    expect(h.run(() => obj)).toBe(obj);
  });

  it("owner() inside run returns that scope's handle and the previous owner is restored after", () => {
    const h = scope(() => {});
    let seen: Scope | undefined;
    h.run(() => {
      seen = owner();
    });
    expect(seen).toBe(h);
    expect(owner()).toBeUndefined();

    let afterInOther: Scope | undefined;
    const other = scope(() => {
      h.run(() => {});
      afterInOther = owner();
    });
    expect(afterInOther).toBe(other);
  });

  it("nodes created inside scope.run(fn) are disposed with that scope", () => {
    const s = mk();
    let runs = 0;
    const h = scope(() => {});
    h.run(() => {
      effect(() => {
        s.get();
        runs++;
      });
    });
    expect(runs).toBe(1);
    s.set(1);
    expect(runs).toBe(2);
    h.dispose();
    s.set(2);
    expect(runs).toBe(2);
  });

  it("an effect created via s.run inside another effect survives that effect's rerun and stops when s is disposed", () => {
    const trigger = mk();
    const data = mk();
    let innerRuns = 0;
    const h = scope(() => {});
    scope(() => {
      effect(() => {
        trigger.get();
        if (innerRuns === 0) {
          h.run(() => {
            effect(() => {
              data.get();
              innerRuns++;
            });
          });
        }
      });
    });
    expect(innerRuns).toBe(1);
    trigger.set(1);
    trigger.set(2);
    data.set(1);
    expect(innerRuns).toBe(2);
    h.dispose();
    data.set(2);
    expect(innerRuns).toBe(2);
  });

  it("a scope created inside run has parent === s", () => {
    const h = scope(() => {});
    let child: Scope | undefined;
    h.run(() => {
      child = scope(() => {});
    });
    expect(child?.parent).toBe(h);
  });

  it("a child scope created inside run is disposed with s", () => {
    const h = scope(() => {});
    let disposed = 0;
    h.run(() => {
      const c = scope(() => {});
      c.onDispose(() => disposed++);
    });
    h.dispose();
    expect(disposed).toBe(1);
  });

  it("E1206: run on a disposed scope throws E1206 and does not call fn", () => {
    const h = scope(() => {});
    h.dispose();
    let called = 0;
    const e = errorOf(() => {
      h.run(() => {
        called++;
      });
    });
    expect(e).toBeInstanceOf(Error);
    if (!(e instanceof Error)) throw new Error("unreachable");
    expect("code" in e && e.code).toBe("E1206");
    expect("see" in e && e.see).toBe("k.reactive");
    expect(e.message.startsWith("E1206")).toBe(true);
    expect(called).toBe(0);
  });

  it("reads inside run do not register dependencies of an enclosing effect", () => {
    const outside = mk();
    const inside = mk();
    const h = scope(() => {});
    let runs = 0;
    scope(() => {
      effect(() => {
        runs++;
        h.run(() => {
          inside.get();
        });
      });
    });
    expect(runs).toBe(1);
    inside.set(1);
    expect(runs).toBe(1);

    let runs2 = 0;
    scope(() => {
      effect(() => {
        runs2++;
        outside.get();
        h.run(() => {
          inside.get();
        });
      });
    });
    inside.set(2);
    expect(runs2).toBe(1);
    outside.set(1);
    expect(runs2).toBe(2);
  });

  it("a write inside run inside an effect to a signal not in that effect's writes is still E1201", () => {
    const other = mk();
    const h = scope(() => {});
    const e = errorOf(() => {
      scope(() => {
        effect(
          () => {
            h.run(() => {
              other.set(1);
            });
          },
          { writes: [] },
        );
      });
    });
    expect(e).toBeInstanceOf(Error);
    expect(e instanceof Error && "code" in e && e.code).toBe("E1201");
  });

  it("a throw from fn propagates and the scope stays live: run works again", () => {
    const h = scope(() => {});
    expect(() =>
      h.run(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(owner()).toBeUndefined();
    expect(h.run(() => 7)).toBe(7);
  });
});
