/** The type of `s.id(brand)`: a string carrying a brand. */
export type Id<B extends string> = string & { readonly __brand: B };
