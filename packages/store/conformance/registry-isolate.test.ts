import { scope } from "@keel/reactive";
import { isolate, store, stores } from "@keel/store";
// k.store Registries (RFC 0022): isolate(scope) gives a scope its own registry; store() registers in, and stores() reads,
// Spec: k.store, clause "Two isolated scopes each hold a live store with the same id, `stores()` under each lists only its own and outside both lists neither."
// the registry of the nearest isolated scope on the owner() chain, else the module registry; a duplicate live id throws only within one registry.
import { describe, expect, it } from "vitest";
import { Cart } from "./fixtures";

const ID = "iso.cart";

describe("k.store: isolated registries", () => {
  it("two isolated scopes each hold a live store with the same id; stores() under each lists only its own and outside both lists neither", () => {
    const made: unknown[] = [];
    const seen: unknown[] = [];
    const a = scope(() => {});
    const b = scope(() => {});
    isolate(a);
    isolate(b);
    expect(() => a.run(() => made.push(store(Cart, { items: [] }, { id: ID })))).not.toThrow();
    expect(() => b.run(() => made.push(store(Cart, { items: [] }, { id: ID })))).not.toThrow();
    seen.push(
      a.run(() => stores().get(ID)),
      b.run(() => stores().get(ID)),
    );
    expect(made[0]).not.toBe(made[1]);
    expect(seen[0]).toBe(made[0]);
    expect(seen[1]).toBe(made[1]);
    expect(a.run(() => stores().size)).toBe(1);
    expect(b.run(() => stores().size)).toBe(1);
    expect(stores().has(ID)).toBe(false);
    a.dispose();
    b.dispose();
  });

  it("a duplicate live id within one isolated scope still throws", () => {
    const a = scope(() => {});
    isolate(a);
    a.run(() => void store(Cart, { items: [] }, { id: ID }));
    expect(() => a.run(() => void store(Cart, { items: [] }, { id: ID }))).toThrow();
    a.dispose();
  });

  it("a nested child scope of an isolated scope registers in the isolated scope's registry", () => {
    const a = scope(() => {});
    isolate(a);
    const child = a.run(() => scope(() => void store(Cart, { items: [] }, { id: ID })));
    expect(a.run(() => stores().has(ID))).toBe(true);
    expect(stores().has(ID)).toBe(false);
    child.dispose();
    expect(a.run(() => stores().has(ID))).toBe(false);
    a.dispose();
  });

  it("disposing an isolated scope drops its stores and leaves a same-id module-level store unaffected", () => {
    const outer = scope(() => {
      store(Cart, { items: [] }, { id: ID });
    });
    const a = scope(() => {});
    isolate(a);
    a.run(() => void store(Cart, { items: [] }, { id: ID }));
    expect(a.run(() => stores().has(ID))).toBe(true);
    a.dispose();
    expect(stores().has(ID)).toBe(true);
    outer.dispose();
    expect(stores().has(ID)).toBe(false);
  });
});
