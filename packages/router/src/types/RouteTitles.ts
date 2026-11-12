import type { Schema } from "@keel/schema";
import type { RouteProps } from "./RouteProps.ts";

/** `RouteProps` with `data` the loader's `ok` value `T`; plain `RouteProps` for an entry without a loader. */
type TitleProps<T> = unknown extends T ? RouteProps : Omit<RouteProps, "data"> & { readonly data: T };

/**
 * What `manifest` gives each entry's `title` (k.head): the route component's props, with `data` the value of the
 * entry's loader `output` schema (`O[K]`, inferred from `loader`), so a title reads it without parsing it again.
 * `component` and `api` (every entry has one) keep each member from being a weak type.
 */
export type RouteTitles<O> = {
  readonly [K in keyof O]: {
    readonly component?: unknown;
    readonly api?: true;
    readonly loader?: { readonly output: Schema<O[K]> };
    title?(props: TitleProps<O[K]>): string;
  };
};
