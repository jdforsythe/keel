/** Resource state union. Transitions are exactly loading -> ready | error. */
export type ResourceState<T> =
  | { readonly state: "loading" }
  | { readonly state: "error"; readonly error: unknown }
  | { readonly state: "ready"; readonly value: T };
