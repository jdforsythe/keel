// Spec: k.reactive, clause "An effect that throws inside a scope with onError delivers the error to that scope's onError and no outer scope's; the throwing effect does not run again; sibling effects still run; without onError the error rethrows from batch."
import { describe, expect, it } from "vitest";
import { batch, computed, effect, scope, signal } from "@keel/reactive";

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

describe("k.reactive: scope onError", () => {
  it("delivers an effect's throw to the scope's onError instead of rethrowing", () => {
    const s = mk();
    const errors: unknown[] = [];
    scope(
      () => {
        effect(() => {
          if (s.get() === 1) throw new Error("boom");
        });
      },
      { onError: (e) => errors.push(e), detached: true },
    );
    expect(() => s.set(1)).not.toThrow();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
  });

  it("goes to the nearest declaring scope and not to outer ones", () => {
    const s = mk();
    const outer: unknown[] = [];
    const inner: unknown[] = [];
    scope(
      () => {
        scope(
          () => {
            scope(() => {
              effect(() => {
                if (s.get() === 1) throw new Error("deep");
              });
            });
          },
          { onError: (e) => inner.push(e) },
        );
      },
      { onError: (e) => outer.push(e), detached: true },
    );
    s.set(1);
    expect(inner).toHaveLength(1);
    expect(outer).toHaveLength(0);
  });

  it("walks past a scope without onError to an outer one", () => {
    const s = mk();
    const outer: unknown[] = [];
    scope(
      () => {
        scope(() => {
          effect(() => {
            if (s.get() === 1) throw new Error("x");
          });
        });
      },
      { onError: (e) => outer.push(e), detached: true },
    );
    s.set(1);
    expect(outer).toHaveLength(1);
  });

  it("the throwing effect does not run again; siblings still run", () => {
    const s = mk();
    let bad = 0;
    let sibling = 0;
    const errors: unknown[] = [];
    scope(
      () => {
        effect(() => {
          bad++;
          if (s.get() >= 1) throw new Error("boom");
        });
        effect(() => {
          s.get();
          sibling++;
        });
      },
      { onError: (e) => errors.push(e), detached: true },
    );
    s.set(1);
    s.set(2);
    s.set(3);
    expect(bad).toBe(2);
    expect(sibling).toBe(4);
    expect(errors).toHaveLength(1);
  });

  it("a computed that throws on read inside an effect reaches onError", () => {
    const s = mk();
    const errors: unknown[] = [];
    scope(
      () => {
        const c = computed(() => {
          if (s.get() === 1) throw new Error("computed");
          return s.get();
        });
        effect(() => {
          c.get();
        });
      },
      { onError: (e) => errors.push(e), detached: true },
    );
    expect(() => s.set(1)).not.toThrow();
    expect(errors).toHaveLength(1);
  });

  it("runs onError after the commit: every effect has run, and outside tracking", () => {
    const s = mk();
    const order: string[] = [];
    scope(
      () => {
        effect(() => {
          if (s.get() === 1) throw new Error("first");
        });
        effect(() => {
          if (s.get() === 1) order.push("later effect");
        });
        effect(() => {
          s.get();
        });
      },
      {
        onError: () => {
          order.push("onError");
          s.get();
        },
        detached: true,
      },
    );
    s.set(1);
    expect(order).toEqual(["later effect", "onError"]);
  });

  it("without onError the error rethrows from batch, after the other effects ran", () => {
    const s = mk();
    let sibling = 0;
    scope(
      () => {
        effect(() => {
          if (s.get() === 1) throw new Error("plain");
        });
        effect(() => {
          s.get();
          sibling++;
        });
      },
      { detached: true },
    );
    expect(() => batch(() => s.set(1))).toThrow("plain");
    expect(sibling).toBe(2);
  });

  it("a throw inside onError propagates", () => {
    const s = mk();
    scope(
      () => {
        effect(() => {
          if (s.get() === 1) throw new Error("orig");
        });
      },
      {
        onError: () => {
          throw new Error("from handler");
        },
        detached: true,
      },
    );
    expect(() => s.set(1)).toThrow("from handler");
  });

  it("an effect failing at creation is delivered too and never reruns", () => {
    const s = mk();
    let runs = 0;
    const errors: unknown[] = [];
    scope(
      () => {
        effect(() => {
          runs++;
          s.get();
          throw new Error("at creation");
        });
      },
      { onError: (e) => errors.push(e), detached: true },
    );
    s.set(1);
    expect(errors).toHaveLength(1);
    expect(runs).toBe(1);
  });
});
