/**
 * A link target built by a manifest's `routes.href()` (k.router). Branded so a plain string where an `Href` is required
 * is a type error (E1501). Only `routes.href()` mints one.
 */
export type Href = string & { readonly __brand: "Href" };
