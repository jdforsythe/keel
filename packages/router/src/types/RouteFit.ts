import type { Ctx } from "@keel/ctx";
import type { Infer } from "@keel/schema";

/** The route's parsed value (`Parsed`) must be assignable to what `fn` declares (`unknown` when unread). */
type Fits<Parsed, Declared> = [Parsed] extends [Declared] ? true : false;
type Parsed<D, K extends "params" | "search"> = D extends { readonly [P in K]: infer X }
  ? Infer<X>
  : Record<never, never>;
type LoaderFits<D> = D extends {
  readonly loader: { run(args: { readonly params: infer P; readonly search: infer S }, ctx: Ctx): unknown };
}
  ? [Fits<Parsed<D, "params">, P>, Fits<Parsed<D, "search">, S>] extends [true, true]
    ? true
    : false
  : true;

/**
 * What `manifest` requires of each entry beyond `RouteDef` (k.router): its loader's `params`/`search` accept `Infer`
 * of the entry's `params`/`search` schema (`{}` when the entry has none), as typing them `Infer<typeof schema>` (or
 * leaving them unread) does; a missing, renamed, or narrower field makes `loader` fail to compile with this message.
 * An entry has no `actions` key: they move to `routes.actions({...})` (E1505, RFC 0063).
 */
export type RouteFit<M> = {
  readonly [K in keyof M]: (LoaderFits<M[K]> extends true
    ? unknown
    : { readonly loader: "loader params/search must be Infer<typeof schema> of this route's params/search" }) &
    (M[K] extends { readonly title: unknown }
      ? M[K] extends { readonly path: string }
        ? unknown
        : { readonly title: "a layout has no title (k.head); declare it on a path route" }
      : unknown) &
    (M[K] extends { readonly actions: unknown }
      ? { readonly actions: "E1505 move actions to routes.actions({ [id]: { POST } }) after the manifest" }
      : unknown);
};
