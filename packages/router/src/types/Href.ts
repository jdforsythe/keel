/**
 * A link target (k.router): made by a manifest's `routes.href()`, or a `MountHref` by an identity mount's `href()`
 * (k.mount). Branded so a plain string where an `Href` is required is a type error (E1501).
 */
export type Href = string & { readonly __brand: "Href" };
