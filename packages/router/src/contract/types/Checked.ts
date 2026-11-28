import type { ApiEntry } from "./ApiEntry.ts";
import type { LayoutEntry } from "./LayoutEntry.ts";
import type { PageEntry } from "./PageEntry.ts";

/** The row an entry literal is checked against: API with `method`, layout with `layout`, else page. */
type RowOf<E> = E extends { readonly method: unknown }
  ? ApiEntry
  : E extends { readonly layout: unknown }
    ? LayoutEntry
    : PageEntry;
/** A member outside the row: a brand, not `never`, so the literal is not reduced and the error stays at the member. */
type Refused<X> = { readonly refusedMember: X };

/**
 * The type `contract` checks its entries against (k.routes Where rules fire): a mapped type keyed by id, so an
 * unprefixed key fails at the key (E1155) and a member its kind refuses, or a missing or mistyped one, fails at or
 * under its entry (E1510).
 */
export type Checked<M extends string, C> = {
  readonly [K in keyof C]: K extends `${M}.${string}`
    ? Row<C[K]>
    : string extends K | M
      ? Row<C[K]>
      : `route id must start with ${M}.`;
};
/** An entry checked against its row; a computed key or module id (`string`) is checked for its kind only. */
type Row<E> = RowOf<E> & { readonly [X in Exclude<keyof E, keyof RowOf<E>>]: Refused<X> };
