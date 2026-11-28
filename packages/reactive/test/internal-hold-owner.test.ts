// `@keel/reactive/internal` exports `holdOwner`: a scope owns what is created until `release`, across awaits. fast-check seed 1337.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { owner, scope } from "../src/index.ts";
import type { Scope } from "../src/index.ts";
import { holdOwner } from "../src/internal/index.ts";

describe("holdOwner", () => {
  it("makes the scope the owner across an await, and release puts back none", async () => {
    const root = scope(() => undefined, { detached: true });
    const release = holdOwner(root);
    await Promise.resolve();
    const made = scope(() => undefined);
    expect(made.parent).toBe(root);
    expect(owner()).toBe(root);
    release();
    expect(owner()).toBeUndefined();
    root.dispose();
  });

  it("ends what was made under it with the scope's disposal", () => {
    const root = scope(() => undefined, { detached: true });
    const release = holdOwner(root);
    const ended: string[] = [];
    scope(() => undefined).onDispose(() => ended.push("module scope"));
    release();
    expect(ended).toEqual([]);
    root.dispose();
    expect(ended).toEqual(["module scope"]);
  });

  it("a second release changes nothing", () => {
    const root = scope(() => undefined, { detached: true });
    const release = holdOwner(root);
    release();
    const outer = scope(() => undefined, { detached: true });
    outer.run(() => {
      release();
      expect(owner()).toBe(outer);
    });
    root.dispose();
    outer.dispose();
  });

  it("property: inside any nesting of scopes, release restores the owner found at the call", () => {
    fc.assert(
      fc.property(fc.nat({ max: 6 }), (depth) => {
        const root = scope(() => undefined, { detached: true });
        const chain: Scope[] = [];
        const nest = (n: number): void => {
          if (n === 0) {
            const found = owner();
            const release = holdOwner(root);
            expect(owner()).toBe(root);
            release();
            expect(owner()).toBe(found);
            return;
          }
          chain.push(scope(() => nest(n - 1)));
        };
        nest(depth);
        for (const s of chain) s.dispose();
        root.dispose();
      }),
      { seed: 1337 },
    );
  });
});
