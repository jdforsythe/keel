/**
 * Where a store maker's state schema comes from in its caller's arguments (k.leave E1107): argument `index`, then the
 * object literal fields `members` name in turn (`spec.data` of `chart(id, spec)`: `{ index: 1, members: ['data'] }`).
 */
export type MakerPath = { readonly index: number; readonly members: readonly string[] };
