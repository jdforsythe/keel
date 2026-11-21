/**
 * What `coverage` reports (std.statecharts): `unreached`, the declared states no explored state holds, and `dead`,
 * the non-final states some terminal explored state holds; both in declaration order.
 */
export type Coverage<S extends string> = { readonly unreached: readonly S[]; readonly dead: readonly S[] };
