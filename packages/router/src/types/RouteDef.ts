import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema } from "@keel/schema";
import type { Guard } from "./Guard.ts";
import type { Loader } from "./Loader.ts";
import type { RouteProps } from "./RouteProps.ts";

/**
 * One manifest entry (k.router). Without `path` it is a layout whose `component` renders `children`. Actions are not
 * part of an entry: `routes.actions({ [id]: { POST, ... } })` attaches them (RFC 0063).
 * `component` and `errorElement` are method signatures so components may declare narrower props.
 */
export interface RouteDef {
  readonly path?: string;
  readonly params?: ObjectSchema<unknown>;
  readonly search?: ObjectSchema<unknown>;
  readonly loader?: Loader<unknown>;
  readonly layout?: string;
  readonly guard?: Guard;
  component(props: RouteProps, slots?: undefined, ctx?: Ctx): Node;
  errorElement?(props: { readonly error: KeelError<string, unknown> }): Node;
  /** A path route's document title (k.head), given the route component's props; a layout takes none. */
  title?(props: RouteProps): string;
}
