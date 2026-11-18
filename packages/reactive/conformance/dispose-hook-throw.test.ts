import { computed, effect, owner, scope, signal } from "@keel/reactive";
import type { Effect, Scope } from "@keel/reactive";
import * as fc from "fast-check";
// Spec: k.reactive Conformance, clause "A throwing `onDispose` hook stops no disposal: every owned node is disposed and
// every later hook runs, `dispose()` rethrows the first error in disposal order (owned nodes before the node's own
// hooks, hooks in registration order), and `scope(fn)` rethrows `fn`'s error over a hook's." Property seed: 1337.
import { describe, expect, it } from "vitest";

const SEED = 1337;

type Outcome = { threw: false } | { threw: true; error: unknown };

function outcomeOf(fn: () => void): Outcome {
  try {
    fn();
  } catch (error) {
    return { threw: true, error };
  }
  return { threw: false };
}

function thrownBy(fn: () => void): unknown {
  const o = outcomeOf(fn);
  if (!o.threw) throw new Error("expected a throw");
  return o.error;
}

function here(): Scope {
  const o = owner();
  if (!o) throw new Error("no owner");
  return o;
}

function mk() {
  let s: ReturnType<typeof signal<number>> | undefined;
  scope(() => {
    s = signal(0);
  });
  if (!s) throw new Error("unreachable");
  return s;
}

function counter() {
  let n = 0;
  return {
    get: () => n,
    bump: () => {
      n++;
    },
  };
}

describe("k.reactive: a throwing onDispose hook stops no disposal", () => {
  it("scope: a throwing hook does not stop later hooks of the same scope, and dispose() rethrows it", () => {
    const err = new Error("hook-1");
    const ran: string[] = [];
    const h = scope(() => {
      const me = here();
      me.onDispose(() => {
        ran.push("a");
        throw err;
      });
      me.onDispose(() => {
        ran.push("b");
      });
    });
    expect(thrownBy(() => h.dispose())).toBe(err);
    expect(ran).toEqual(["a", "b"]);
  });

  it("scope: every owned effect is disposed and the later scope hook runs when an owned node's hook and the scope's first hook throw; dispose() rethrows the owned node's error", () => {
    const owned = new Error("owned");
    const own = new Error("own");
    const log: string[] = [];
    const s = mk();
    const runs = [counter(), counter(), counter()];
    const h = scope(() => {
      const me = here();
      me.onDispose(() => {
        log.push("scope-1");
        throw own;
      });
      me.onDispose(() => {
        log.push("scope-2");
      });
      for (const r of runs) {
        scope(() => {
          if (r === runs[0]) {
            here().onDispose(() => {
              log.push("owned-1");
              throw owned;
            });
          }
          effect(() => {
            s.get();
            r.bump();
          });
        });
      }
    });
    expect(runs.map((r) => r.get())).toEqual([1, 1, 1]);
    expect(thrownBy(() => h.dispose())).toBe(owned);
    expect(log).toEqual(["owned-1", "scope-1", "scope-2"]);
    s.set(1);
    expect(runs.map((r) => r.get())).toEqual([1, 1, 1]);
  });

  it("scope: an owned effect's disposal still happens when a hook of the scope throws", () => {
    const err = new Error("hook");
    const s = mk();
    const r = counter();
    const h = scope(() => {
      here().onDispose(() => {
        throw err;
      });
      effect(() => {
        s.get();
        r.bump();
      });
    });
    expect(thrownBy(() => h.dispose())).toBe(err);
    s.set(1);
    expect(r.get()).toBe(1);
  });

  it("several throwing hooks: dispose() rethrows the first registered hook's error and drops the rest", () => {
    const errs = [new Error("one"), new Error("two"), new Error("three")];
    const ran: number[] = [];
    const h = scope(() => {
      const me = here();
      errs.forEach((e, i) => {
        me.onDispose(() => {
          ran.push(i);
          throw e;
        });
      });
    });
    expect(thrownBy(() => h.dispose())).toBe(errs[0]);
    expect(ran).toEqual([0, 1, 2]);
  });

  it("owned nodes before the node's own hooks: an owned node's error wins over the owner's own hook registered earlier", () => {
    const owned = new Error("owned");
    const own = new Error("own");
    const h = scope(() => {
      here().onDispose(() => {
        throw own;
      });
      scope(() => {
        here().onDispose(() => {
          throw owned;
        });
      });
    });
    expect(thrownBy(() => h.dispose())).toBe(owned);
  });

  it("owned nodes before the node's own hooks: with only the owner's hook throwing, its error surfaces after the owned hooks ran", () => {
    const own = new Error("own");
    const log: string[] = [];
    const h = scope(() => {
      here().onDispose(() => {
        log.push("own");
        throw own;
      });
      scope(() => {
        here().onDispose(() => {
          log.push("owned");
        });
      });
    });
    expect(thrownBy(() => h.dispose())).toBe(own);
    expect(log).toEqual(["owned", "own"]);
  });

  it("owned nodes are disposed in creation order, so the first created throwing owned node's error surfaces", () => {
    const errs = [new Error("c0"), new Error("c1")];
    const log: number[] = [];
    const h = scope(() => {
      errs.forEach((e, i) => {
        scope(() => {
          here().onDispose(() => {
            log.push(i);
            throw e;
          });
        });
      });
    });
    expect(thrownBy(() => h.dispose())).toBe(errs[0]);
    expect(log).toEqual([0, 1]);
  });

  it("effect as owner: a throwing hook in an owned scope stops no disposal and effect.dispose() rethrows the first error", () => {
    const errs = [new Error("e0"), new Error("e1")];
    const log: string[] = [];
    const s = mk();
    const inner = counter();
    let fx: Effect | undefined;
    scope(() => {
      fx = effect(() => {
        errs.forEach((e, i) => {
          scope(() => {
            here().onDispose(() => {
              log.push(`h${i}`);
              throw e;
            });
          });
        });
        scope(() => {
          here().onDispose(() => {
            log.push("last");
          });
          effect(() => {
            s.get();
            inner.bump();
          });
        });
      });
    });
    expect(inner.get()).toBe(1);
    if (!fx) throw new Error("no effect");
    expect(thrownBy(() => fx?.dispose())).toBe(errs[0]);
    expect(log).toEqual(["h0", "h1", "last"]);
    s.set(1);
    expect(inner.get()).toBe(1);
  });

  it("effect as owner: disposing the owning scope rethrows an error from a hook in a scope the effect owns, and later hooks run", () => {
    const err = new Error("in-effect");
    const log: string[] = [];
    const h = scope(() => {
      here().onDispose(() => {
        log.push("outer");
      });
      effect(() => {
        scope(() => {
          here().onDispose(() => {
            log.push("inner");
            throw err;
          });
        });
      });
    });
    expect(thrownBy(() => h.dispose())).toBe(err);
    expect(log).toEqual(["inner", "outer"]);
  });

  it("computed as owner: a throwing hook in a scope a computed owns stops no disposal and disposing the owning scope rethrows it", () => {
    const errs = [new Error("c0"), new Error("c1")];
    const log: string[] = [];
    const h = scope(() => {
      here().onDispose(() => {
        log.push("outer");
      });
      const c = computed(() => {
        errs.forEach((e, i) => {
          scope(() => {
            here().onDispose(() => {
              log.push(`h${i}`);
              throw e;
            });
          });
        });
        return 1;
      });
      effect(() => {
        c.get();
      });
    });
    expect(thrownBy(() => h.dispose())).toBe(errs[0]);
    expect(log).toEqual(["h0", "h1", "outer"]);
  });

  it("scope(fn): when fn throws and a hook throws too, scope(fn) rethrows fn's error", () => {
    const fnErr = new Error("fn");
    const hookErr = new Error("hook");
    const log: string[] = [];
    const e = thrownBy(() =>
      scope(() => {
        here().onDispose(() => {
          log.push("hook");
          throw hookErr;
        });
        throw fnErr;
      }),
    );
    expect(e).toBe(fnErr);
    expect(log).toEqual(["hook"]);
  });

  it("scope(fn): when fn throws and an owned node's hook throws too, scope(fn) rethrows fn's error and every hook runs", () => {
    const fnErr = new Error("fn");
    const log: string[] = [];
    const e = thrownBy(() =>
      scope(() => {
        here().onDispose(() => {
          log.push("own");
          throw new Error("own");
        });
        scope(() => {
          here().onDispose(() => {
            log.push("owned");
            throw new Error("owned");
          });
        });
        throw fnErr;
      }),
    );
    expect(e).toBe(fnErr);
    expect(log).toEqual(["owned", "own"]);
  });

  it("scope.run(fn): when fn throws, run rethrows fn's error and the scope's throwing hook surfaces from its later dispose()", () => {
    const fnErr = new Error("fn");
    const hookErr = new Error("hook");
    const h = scope(() => {
      here().onDispose(() => {
        throw hookErr;
      });
    });
    expect(
      thrownBy(() =>
        h.run(() => {
          throw fnErr;
        }),
      ),
    ).toBe(fnErr);
    expect(thrownBy(() => h.dispose())).toBe(hookErr);
  });

  it("scope.run(fn): when fn throws out of a nested scope(fn) whose hook throws too, run rethrows fn's error", () => {
    const fnErr = new Error("fn");
    const hookErr = new Error("hook");
    const outer = scope(() => {});
    const e = thrownBy(() =>
      outer.run(() => {
        scope(() => {
          here().onDispose(() => {
            throw hookErr;
          });
          throw fnErr;
        });
      }),
    );
    expect(e).toBe(fnErr);
  });

  it("scope.run(fn): a scope disposed after run created hooked nodes rethrows the first hook error and runs every hook", () => {
    const errs = [new Error("r0"), new Error("r1")];
    const ran: number[] = [];
    const h = scope(() => {});
    h.run(() => {
      errs.forEach((e, i) => {
        here().onDispose(() => {
          ran.push(i);
          throw e;
        });
      });
    });
    expect(thrownBy(() => h.dispose())).toBe(errs[0]);
    expect(ran).toEqual([0, 1]);
  });

  it("a throwing hook leaves the scope disposed: a second dispose() does not rerun hooks", () => {
    const calls = counter();
    const h = scope(() => {
      here().onDispose(() => {
        calls.bump();
        throw new Error("hook");
      });
    });
    expect(outcomeOf(() => h.dispose()).threw).toBe(true);
    expect(calls.get()).toBe(1);
    expect(outcomeOf(() => h.dispose()).threw).toBe(false);
    expect(calls.get()).toBe(1);
  });

  it("property: for any tree of owned scopes with any subset of hooks throwing, every hook runs exactly once and dispose() rethrows the first error in disposal order", () => {
    interface Tree {
      hooks: boolean[];
      children: Tree[];
    }
    const tree: (depth: number) => fc.Arbitrary<Tree> = fc.memo<Tree>((depth): fc.Arbitrary<Tree> =>
      depth <= 1
        ? fc.record({ hooks: fc.array(fc.boolean(), { maxLength: 3 }), children: fc.constant([]) })
        : fc.record({
            hooks: fc.array(fc.boolean(), { maxLength: 3 }),
            children: fc.array(tree(depth - 1), { maxLength: 3 }),
          }),
    );

    fc.assert(
      fc.property(tree(3), (root) => {
        const ran: string[] = [];
        const expectedOrder: string[] = [];
        const expectedThrows: string[] = [];

        const plan = (t: Tree, id: string): void => {
          t.children.forEach((c, i) => plan(c, `${id}.${i}`));
          t.hooks.forEach((throws, i) => {
            const name = `${id}#${i}`;
            expectedOrder.push(name);
            if (throws) expectedThrows.push(name);
          });
        };
        plan(root, "r");

        const build = (t: Tree, id: string) =>
          scope(() => {
            const me = here();
            t.hooks.forEach((throws, i) => {
              const name = `${id}#${i}`;
              me.onDispose(() => {
                ran.push(name);
                if (throws) throw new Error(name);
              });
            });
            t.children.forEach((c, i) => {
              build(c, `${id}.${i}`);
            });
          });

        const h = build(root, "r");
        const o = outcomeOf(() => h.dispose());
        expect(ran).toEqual(expectedOrder);
        const first = expectedThrows[0];
        if (first === undefined) {
          expect(o.threw).toBe(false);
        } else {
          expect(o.threw).toBe(true);
          if (o.threw) {
            expect(o.error).toBeInstanceOf(Error);
            expect(o.error instanceof Error && o.error.message).toBe(first);
          }
        }
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});
