/**
 * The type of `s.format(name, base, ...)`: `base`'s type `T` branded `name`. Not assignable from plain `T` nor
 * across names; assignable to `T`. A format over a format carries both names.
 */
export type Format<T, N extends string> = T & { readonly __format: { readonly [K in N]: true } };
