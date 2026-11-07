import type { Ctx } from "@keel/ctx";
import type { KeelError, ObjectSchema } from "@keel/schema";
import type { Action } from "./Action.ts";
import type { Guard } from "./Guard.ts";
import type { Loader } from "./Loader.ts";
import type { RouteProps } from "./RouteProps.ts";

/**
 * One manifest entry (k.router). Without `path` it is a layout whose `component` renders `children`.
 * `component` and `errorElement` are method signatures so components may declare narrower props.
 */
export interface RouteDef {
  readonly path?: string;
  readonly params?: ObjectSchema<unknown>;
  readonly search?: ObjectSchema<unknown>;
  readonly loader?: Loader<unknown>;
  readonly actions?: {
    readonly POST?: Action<unknown>;
    readonly PUT?: Action<unknown>;
    readonly PATCH?: Action<unknown>;
    readonly DELETE?: Action<unknown>;
  };
  readonly layout?: string;
  readonly guard?: Guard;
  component(props: RouteProps, slots?: undefined, ctx?: Ctx): Node;
  errorElement?(props: { readonly error: KeelError<string, unknown> }): Node;
}
