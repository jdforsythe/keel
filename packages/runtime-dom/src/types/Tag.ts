/**
 * The discriminant values of `U` (`state` or `tag`); any string when `U` is not given (TypeScript cannot infer
 * the union from the enclosing `Match`, so write `<Case<State> tag="ready">` to narrow).
 */
export type Tag<U> = unknown extends U
  ? string
  : U extends { readonly state: infer S extends string }
    ? S
    : U extends { readonly tag: infer S extends string }
      ? S
      : never;
