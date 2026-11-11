import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema } from "@keel/schema";
import type { Guard } from "./Guard.ts";
import type { Loader } from "./Loader.ts";
import type { RouteProps } from "./RouteProps.ts";

interface Base {
  readonly params?: ObjectSchema<unknown>;
  readonly search?: ObjectSchema<unknown>;
  readonly loader?: Loader<unknown>;
}

/**
 * A page (with `path`) or a layout (without; its `component` renders `children`). Its guard has a `redirect` (E1508).
 * `component` and `errorElement` are method signatures so components may declare narrower props.
 */
interface ViewDef extends Base {
  readonly api?: never;
  readonly path?: string;
  readonly layout?: string;
  readonly guard?: Guard & { readonly redirect: string };
  component(props: RouteProps, slots?: undefined, ctx?: Ctx): Node;
  errorElement?(props: { readonly error: KeelError<string, unknown> }): Node;
  /** A path route's document title (k.head), given the route component's props; a layout takes none. */
  title?(props: RouteProps): string;
}

/** An API route (k.api): answers JSON, has no view; a loader or actions attached with `routes.actions`. */
interface ApiDef extends Base {
  readonly api: true;
  readonly path: string;
  readonly guard?: Guard;
  readonly component?: never;
  readonly errorElement?: never;
  readonly title?: never;
  readonly layout?: never;
}

/**
 * One manifest entry (k.router, k.api): a page (`path`, `component`), a layout (`component`, no `path`) or an API
 * route (`api: true`, `path`, no view). An entry with neither `component` nor `api: true` is no `RouteDef` (E1510).
 * Actions are not part of an entry: `routes.actions({ [id]: { POST, ... } })` attaches them.
 */
export type RouteDef = ViewDef | ApiDef;
