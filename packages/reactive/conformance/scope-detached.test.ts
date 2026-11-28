// Spec: k.reactive, clause "A `detached` scope created inside another scope has no `parent`, survives that scope's disposal with its effects still running, and its effect's throw reaches no outer `onError`; its `dispose()` disposes it."
// Spec: k.reactive, clause "Reads inside a `detached` scope's `fn` do not register dependencies of an enclosing effect."
// Property seed: 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { effect, scope, signal } from "@keel/reactive";
import type { Scope } from "@keel/reactive";

function mk() {
  let s: ReturnType<typeof signal<number>> | undefined;
  scope(
    () => {
      s = signal(0);
    },
    { detached: true },
  );
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

function codeOf(e: unknown): unknown {
  return typeof e === "object" && e !== null && "code" in e ? e.code : undefined;
}

describe("k.reactive: detached scope", () => {
  it("a detached scope created inside another scope has no parent", () => {
    let inner: Scope | undefined;
    const outer = scope(
      () => {
        inner = scope(() => {}, { detached: true });
      },
      { detached: true },
    );
    expect(inner).toBeDefined();
    expect(inner?.parent).toBeUndefined();
    expect(outer.parent).toBeUndefined();
    const plain = scope(
      () => {
        inner = scope(() => {});
      },
      { detached: true },
    );
    expect(inner?.parent).toBe(plain);
  });

  it("a detached scope survives the enclosing scope's disposal with its effects still running", () => {
    const s = mk();
    let runs = 0;
    const outer = scope(
      () => {
        scope(
          () => {
            effect(() => {
              s.get();
              runs++;
            });
          },
          { detached: true },
        );
      },
      { detached: true },
    );
    expect(runs).toBe(1);
    outer.dispose();
    s.set(1);
    expect(runs).toBe(2);
  });

  it("any number of writes after outer disposal re-run the detached effect each time", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20 }), (n) => {
        const s = mk();
        let runs = 0;
        const outer = scope(
          () => {
            scope(
              () => {
                effect(() => {
                  s.get();
                  runs++;
                });
              },
              { detached: true },
            );
          },
          { detached: true },
        );
        outer.dispose();
        for (let i = 1; i <= n; i++) s.set(i);
        expect(runs).toBe(1 + n);
      }),
      { seed: 1337 },
    );
  });

  it("a detached scope's effect throw reaches no outer onError and rethrows without its own onError", () => {
    const s = mk();
    const outerErrors: unknown[] = [];
    scope(
      () => {
        scope(
          () => {
            effect(() => {
              if (s.get() === 1) throw new Error("detached boom");
            });
          },
          { detached: true },
        );
      },
      { onError: (e) => outerErrors.push(e), detached: true },
    );
    const thrown = errorOf(() => s.set(1));
    expect(thrown).toBeInstanceOf(Error);
    expect(outerErrors).toHaveLength(0);
  });

  it("a detached scope's own onError receives its effect's throw", () => {
    const s = mk();
    const outerErrors: unknown[] = [];
    const own: unknown[] = [];
    scope(
      () => {
        scope(
          () => {
            effect(() => {
              if (s.get() === 1) throw new Error("own");
            });
          },
          { detached: true, onError: (e) => own.push(e) },
        );
      },
      { onError: (e) => outerErrors.push(e), detached: true },
    );
    s.set(1);
    expect(own).toHaveLength(1);
    expect(outerErrors).toHaveLength(0);
  });

  it("a detached scope's dispose() disposes it: its effect stops and run throws E1206", () => {
    const s = mk();
    let runs = 0;
    let inner: Scope | undefined;
    const outer = scope(
      () => {
        inner = scope(
          () => {
            effect(() => {
              s.get();
              runs++;
            });
          },
          { detached: true },
        );
      },
      { detached: true },
    );
    outer.dispose();
    s.set(1);
    expect(runs).toBe(2);
    inner?.dispose();
    s.set(2);
    expect(runs).toBe(2);
    expect(codeOf(errorOf(() => inner?.run(() => 1)))).toBe("E1206");
  });

  it("a detached scope created inside an effect survives that effect's re-run", () => {
    const s = mk();
    const trigger = mk();
    let inner: Scope | undefined;
    let detachedRuns = 0;
    scope(
      () => {
        effect(() => {
          trigger.get();
          if (!inner) {
            inner = scope(
              () => {
                effect(() => {
                  s.get();
                  detachedRuns++;
                });
              },
              { detached: true },
            );
          }
        });
      },
      { detached: true },
    );
    trigger.set(1);
    trigger.set(2);
    s.set(1);
    expect(detachedRuns).toBe(2);
    expect(inner?.parent).toBeUndefined();
  });

  it("reads inside a detached scope's fn do not register dependencies of an enclosing effect", () => {
    const s = mk();
    let outerRuns = 0;
    let detachedRuns = 0;
    scope(
      () => {
        effect(() => {
          outerRuns++;
          scope(
            () => {
              s.get();
              detachedRuns++;
            },
            { detached: true },
          );
        });
      },
      { detached: true },
    );
    s.set(1);
    s.set(2);
    expect(outerRuns).toBe(1);
    expect(detachedRuns).toBe(1);
  });
});
