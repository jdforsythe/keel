import type { ObjectSchema } from "@keel/schema";
import type { ActionsFit } from "./ActionsFit.ts";
import type { Href } from "./Href.ts";
import type { RouteActions } from "./RouteActions.ts";
import type { RouteDef } from "./RouteDef.ts";

type None = Readonly<Record<string, never>>;
type Rec = Readonly<Record<string, unknown>>;
type SearchOf<D> = D extends { readonly search: ObjectSchema<infer S extends Rec> } ? S : None;
/** `href` arguments after the id: `params` required iff the route declares them; `search` always optional. */
type HrefArgs<M, K extends keyof M> = string extends keyof M
  ? [params?: Rec, search?: Rec]
  : M[K] extends { readonly params: ObjectSchema<infer P extends Rec> }
    ? [params: P, search?: SearchOf<M[K]>]
    : [params?: None, search?: SearchOf<M[K]>];
/** Ids of routes matching `D`; any string for an untyped table. */
type IdOf<M, D> = string extends keyof M
  ? string
  : { [K in keyof M & string]: M[K] extends D ? K : never }[keyof M & string];

/**
 * A validated route table returned by `manifest()`; route ids are the literal keys of `routes`. `href` links to one of
 * its pages (k.router Links): `id` is a key with a `path` that is no API route (k.api), `params`/`search` are `Infer`
 * of that route's schemas. With an untyped table (non-literal keys) `href` takes any id and plain records. `actions`
 * attaches the actions of a page or API route by method in a statement after the manifest, so an action may
 * `return ok(routes.href(...))`.
 */
export type Manifest<M extends Readonly<Record<string, RouteDef>>> = {
  readonly kind: "keel.manifest";
  readonly routes: M;
  href<K extends IdOf<M, { readonly path: string; readonly api?: never }>>(id: K, ...args: HrefArgs<M, K>): Href;
  actions<A extends { readonly [K in IdOf<M, { readonly path: string }>]?: RouteActions }>(
    actions: A & ActionsFit<M, A>,
  ): void;
};
