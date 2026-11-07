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
type ActionFits<D, A> = A extends { run(input: never, at: { readonly params: infer P }, ctx: Ctx): unknown }
  ? Fits<Parsed<D, "params">, P>
  : true;
type ActionsFit<D> = D extends { readonly actions: infer M }
  ? false extends { [V in keyof M]-?: ActionFits<D, M[V]> }[keyof M]
    ? false
    : true
  : true;

/**
 * What `manifest` requires of each entry beyond `RouteDef` (k.router): its loader's `params`/`search` and each
 * action's `params` accept `Infer` of the entry's `params`/`search` schema (`{}` when the entry has none), as
 * typing them `Infer<typeof schema>` (or leaving them unread) does. A missing, renamed, or narrower field makes the
 * `loader` or `actions` key fail to compile with this message.
 */
export type RouteFit<M> = {
  readonly [K in keyof M]: (LoaderFits<M[K]> extends true
    ? unknown
    : { readonly loader: "loader params/search must be Infer<typeof schema> of this route's params/search" }) &
    (ActionsFit<M[K]> extends true
      ? unknown
      : { readonly actions: "action params must be Infer<typeof schema> of this route's params" });
};
