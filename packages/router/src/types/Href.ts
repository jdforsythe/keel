/**
 * A link target built by `href()` (k.router). Branded so a plain string where an `Href` is required is a
 * type error (E1501). Only `href()` mints one.
 */
export type Href = string & { readonly __brand: "Href" };
