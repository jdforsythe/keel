/** The variants of `U` whose discriminant (`state` or `tag`) is `T`; `unknown` when `U` is not given. */
export type Variant<U, T extends string> = unknown extends U
  ? unknown
  : U extends { readonly state: T } | { readonly tag: T }
    ? U
    : never;
