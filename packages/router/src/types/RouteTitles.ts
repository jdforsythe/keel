import type { Schema } from "@keel/schema";
import type { RouteDef } from "./RouteDef.ts";
import type { RouteProps } from "./RouteProps.ts";

/** `Props` with field `F` of type `T`; `Props` unchanged when `T` is `unknown` (the entry declares no such schema). */
type With<Props, F extends "params" | "search" | "data", T> = unknown extends T
  ? Props
  : Omit<Props, F> & { readonly [Q in F]: T };

/** `T[K]`, or `unknown` when `K` is no key of `T`. */
type At<T, K> = K extends keyof T ? T[K] : unknown;

/**
 * What `manifest` gives each entry's `title` (k.head): the route component's props, with `data` the value of the
 * entry's loader `output` schema (`O[K]`) and `params`/`search` the values of its `params`/`search` schemas (`P[K]`,
 * `S[K]`), each inferred from the entry, so a title reads them without parsing again. A field whose schema the entry
 * lacks stays as in `RouteProps`. Each member is a `RouteDef` too, so an entry `RouteDef` refuses fails at its own key.
 */
export type RouteTitles<O, P, S> = {
  readonly [K in keyof O]: RouteDef<never> & {
    readonly loader?: { readonly output: Schema<O[K]> };
    title?(props: With<With<With<RouteProps, "data", O[K]>, "params", At<P, K>>, "search", At<S, K>>): string;
  };
} & { readonly [K in keyof P]: { readonly params?: Schema<P[K]> } } & {
  readonly [K in keyof S]: { readonly search?: Schema<S[K]> };
};
