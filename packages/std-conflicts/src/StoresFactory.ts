/**
 * A server state factory (k.server): `(ctx) => S`, an object whose values include stores and their transactions.
 * The analysis calls it without a ctx, so it must not read one.
 */
export type StoresFactory = (...ctx: never[]) => object;
