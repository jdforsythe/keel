import type { Schema } from "@keel/schema";
import type { RouteDef } from "./RouteDef.ts";
import type { RouteProps } from "./RouteProps.ts";

/** `RouteProps` with `data` the loader's `ok` value `T`; plain `RouteProps` for an entry without a loader. */
type TitleProps<T> = unknown extends T ? RouteProps : Omit<RouteProps, "data"> & { readonly data: T };

/**
 * What `manifest` gives each entry's `title` (k.head): the route component's props, with `data` the value of the
 * entry's loader `output` schema (`O[K]`, inferred from `loader`), so a title reads it without parsing it again.
 * Each member is a `RouteDef` too, so an entry `RouteDef` refuses fails at its own key.
 */
export type RouteTitles<O> = {
  readonly [K in keyof O]: RouteDef<never> & {
    readonly loader?: { readonly output: Schema<O[K]> };
    title?(props: TitleProps<O[K]>): string;
  };
};
