// Spec: k.store, clause "`isStore(cart)` and `isTransaction(addItem)` are true, `isStore(addItem)`, `isTransaction(cart)` and `isStore({ id: 'cart', get() {}, snapshot() {}, restore() {}, head() {} })` false."
// k.store, Guards "`isStore(x)` and `isTransaction(x)` (`@keel/store`) are true only of a value `store` or `transaction` made, which each marks with an own, non-enumerable property keyed by `Symbol.for('keel.store')` or `Symbol.for('keel.transaction')`: a key guard (k.unsafe Type predicates), so code that holds an `unknown` narrows it to `Store<unknown>` or `Transaction<unknown, unknown>` with no cast."
// Seed 1337 (fixtures.ts).
import { isStore, isTransaction } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { makeCart, opts } from "./fixtures.ts";

const ident = fc.stringMatching(/^[a-z]{3,8}$/);

describe("k.store: guards", () => {
  it("`isStore(cart)` and `isTransaction(addItem)` are true", () => {
    const { cart, add } = makeCart();
    expect(isStore(cart)).toBe(true);
    expect(isTransaction(add)).toBe(true);
  });

  it("`isStore(addItem)` and `isTransaction(cart)` are false", () => {
    const { cart, add } = makeCart();
    expect(isStore(add)).toBe(false);
    expect(isTransaction(cart)).toBe(false);
  });

  it("`isStore({ id: 'cart', get() {}, snapshot() {}, restore() {}, head() {} })` is false", () => {
    expect(isStore({ id: "cart", get() {}, snapshot() {}, restore() {}, head() {} })).toBe(false);
  });

  it("property: for any store id, the store is a store and no transaction, and its transactions are transactions and no store", () => {
    fc.assert(
      fc.property(ident, ident, (mod, name) => {
        const { cart, add, pop, clear } = makeCart({ id: `${mod}.${name}` });
        expect(isStore(cart)).toBe(true);
        expect(isTransaction(cart)).toBe(false);
        for (const t of [add, pop, clear]) {
          expect(isTransaction(t)).toBe(true);
          expect(isStore(t)).toBe(false);
        }
      }),
      opts,
    );
  });

  it("property: no other value is a store or a transaction", () => {
    fc.assert(
      fc.property(fc.anything(), (x) => {
        expect(isStore(x)).toBe(false);
        expect(isTransaction(x)).toBe(false);
      }),
      opts,
    );
  });

  it("a store holds an own, non-enumerable property keyed by `Symbol.for('keel.store')`, and a transaction one keyed by `Symbol.for('keel.transaction')`", () => {
    const { cart, add } = makeCart();
    const s = Object.getOwnPropertyDescriptor(cart, Symbol.for("keel.store"));
    const t = Object.getOwnPropertyDescriptor(add, Symbol.for("keel.transaction"));
    expect(s).toBeDefined();
    expect(s?.enumerable).toBe(false);
    expect(t).toBeDefined();
    expect(t?.enumerable).toBe(false);
    expect(Object.getOwnPropertyDescriptor(cart, Symbol.for("keel.transaction"))).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(add, Symbol.for("keel.store"))).toBeUndefined();
  });
});
