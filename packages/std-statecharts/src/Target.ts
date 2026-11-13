/**
 * Where an event leads (std.statecharts): a state name, or `{ to?, guard?, do? }`: move to `to` (absent: stay) when the
 * guard named `guard` holds, applying the action named `do`.
 */
export type Target<S extends string, G extends string, A extends string> =
  | S
  | { readonly to?: S; readonly guard?: G; readonly do?: A };
