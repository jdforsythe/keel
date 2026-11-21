// `@keel/reactive/internal` exports `reaction`: the computation whose reads subscribe right now, or null.
import { describe, expect, it } from "vitest";
import { computed, effect, scope, signal } from "../src/index.ts";
import { reaction } from "../src/internal/index.ts";

describe("reaction", () => {
  it("is null outside any computation", () => {
    expect(reaction()).toBeNull();
  });

  it("is the running effect inside it and null again after", () => {
    const seen: Array<object | null> = [];
    scope(() => {
      effect(() => {
        seen.push(reaction());
      });
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toBeNull();
    expect(reaction()).toBeNull();
  });

  it("is the same identity across runs of one effect and differs between effects", () => {
    let s: ReturnType<typeof signal<number>> | undefined;
    const a: Array<object | null> = [];
    const b: Array<object | null> = [];
    scope(() => {
      const sig = signal(0);
      s = sig;
      effect(() => {
        sig.get();
        a.push(reaction());
      });
      effect(() => {
        sig.get();
        b.push(reaction());
      });
    });
    s?.set(1);
    expect(a).toHaveLength(2);
    expect(a[0]).toBe(a[1]);
    expect(a[0]).not.toBe(b[0]);
  });

  it("is the computed while it evaluates", () => {
    let inside: object | null = null;
    scope(() => {
      const c = computed(() => {
        inside = reaction();
        return 1;
      });
      c.get();
    });
    expect(inside).not.toBeNull();
  });
});
