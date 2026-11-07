import { type Transaction, tx } from "@keel/store";
// Spec: k.store a payload not assignable to the transaction's payload type is a compile error and an `unknown` one compiles. Seed 1337.
// Type-level (no ts-expect-error, per brands.test.ts): `Callable` asks whether some `tx` overload accepts the arguments;
// `toEqualTypeOf<true|false>` fails tsc if a bad payload starts compiling or a good one stops.
import { describe, expect, expectTypeOf, it } from "vitest";
import { makeCart } from "./fixtures";

type TxOf<X> = X extends Transaction<infer T, infer P> ? typeof tx<T, P> : never;
type Callable<F, Args extends unknown[]> = F extends (...a: Args) => unknown ? true : false;

describe("k.store: typed payload", () => {
  const k = makeCart();
  const item = { sku: "a", qty: 1 };
  type Add = TxOf<typeof k.add>;
  type Pop = TxOf<typeof k.pop>;
  type AddT = typeof k.add;
  type PopT = typeof k.pop;

  it("a payload not assignable to the transaction's payload type is a compile error: wrong shape is rejected", () => {
    expectTypeOf<Callable<Add, [AddT, { item: { sku: string; qty: number } }]>>().toEqualTypeOf<true>();
    expectTypeOf<Callable<Add, [AddT, { item: number }]>>().toEqualTypeOf<false>();
    expectTypeOf<Callable<Add, [AddT, { item: { sku: number; qty: number } }]>>().toEqualTypeOf<false>();
    expectTypeOf<Callable<Add, [AddT, string]>>().toEqualTypeOf<false>();
    expectTypeOf<Callable<Add, [AddT, Record<never, never>]>>().toEqualTypeOf<false>();
    expect(tx(k.add, { item }).ok).toBe(true);
  });

  it("a payload not assignable to the transaction's payload type is a compile error: another transaction's payload is rejected", () => {
    expectTypeOf<Callable<Pop, [PopT, Record<never, never>]>>().toEqualTypeOf<true>();
    expectTypeOf<Callable<Pop, [PopT, null]>>().toEqualTypeOf<false>();
    expectTypeOf<Callable<Add, [AddT, Record<never, never>]>>().toEqualTypeOf<false>();
    expect(tx(k.pop, {}).ok).toBe(true);
  });

  it("an `unknown` payload compiles and is validated at run time", () => {
    const wire: unknown = { item };
    const bad: unknown = { item: 1 };
    // The call below is itself type-checked: tsc fails this file if an `unknown` payload stops compiling.
    expect(tx(k.add, wire).ok).toBe(true);
    const r = tx(k.add, bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("schema.invalid");
  });
});
