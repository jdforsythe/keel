// Spec: k.identity, clause "`isSchema(S)`, `isStore(st)`, `isTransaction(tx)` and `isRouteTable(routes)` are true of what `s.object`, `store`, `transaction` and `manifest` returned; each is false of `{ ...v }`, of an object given every own key and descriptor of `v`, and of a function or object declaring `Symbol.for('keel.schema')`, `Symbol.for('keel.store')` or `Symbol.for('keel.action')` as an own key."
// Spec: k.store, clause "`isStore(cart)` and `isTransaction(addItem)` are true, `isStore(addItem)`, `isTransaction(cart)` and `isStore({ id: 'cart', get() {}, snapshot() {}, restore() {}, head() {} })` false."
// k.store, Guards "`isStore(x)` and `isTransaction(x)` (`@keel/store`) are true only of a value `store` or `transaction` made, by the kernel's own record of them and no property of the value (k.identity), so code that holds an `unknown` narrows it to `Store<unknown>` or `Transaction<unknown, unknown>` with no cast."
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

  it("a copy of a store or a transaction is neither: a spread, an object given every own key and descriptor, and one declaring Symbol.for('keel.store') or Symbol.for('keel.transaction')", () => {
    const { cart, add } = makeCart();
    const clone = (v: object): object => {
      const o = Object.create(Object.getPrototypeOf(v));
      for (const k of Reflect.ownKeys(v)) {
        const d = Object.getOwnPropertyDescriptor(v, k);
        if (d !== undefined) Object.defineProperty(o, k, d);
      }
      return o;
    };
    for (const v of [cart, add]) {
      for (const c of [
        { ...v },
        clone(v),
        Object.assign({}, v),
        Object.assign(Object.create(Object.getPrototypeOf(v)), v),
      ]) {
        expect(isStore(c)).toBe(false);
        expect(isTransaction(c)).toBe(false);
      }
    }
    expect(isStore({ [Symbol.for("keel.store")]: true })).toBe(false);
    expect(isTransaction({ [Symbol.for("keel.transaction")]: true })).toBe(false);
  });
});
