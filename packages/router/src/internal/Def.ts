import type { Ctx } from "@keel/ctx";
import type { KeelError } from "@keel/schema";
import type { Contract } from "../contract/types/Contract.ts";
import type { Action } from "../types/Action.ts";
import type { ApiAction } from "../types/ApiAction.ts";
import type { ApiGuard } from "../types/ApiGuard.ts";
import type { Loader } from "../types/Loader.ts";
import type { RouteProps } from "../types/RouteProps.ts";
import type { Verb } from "../types/Verb.ts";
import type { EntryShape } from "./EntryShape.ts";

/**
 * One route of a route table as the kernel runs it: its contract entry (`EntryShape`) with its binding. `actions`
 * holds a page's actions by verb, or an API write entry's action under its `method`; an API GET entry's handler is
 * `loader`. A member a browser build stubbed (`serverOnly`) is the stub.
 */
export type Def = EntryShape & {
  readonly contract: Contract;
  readonly layout?: string;
  readonly guard?: ApiGuard;
  readonly loader?: Loader;
  readonly actions: Readonly<Partial<Record<Verb, Action | ApiAction>>>;
  component?(props: RouteProps, ctx: Ctx): Node;
  errorElement?(props: { readonly error: KeelError<string, unknown> }, ctx: Ctx): Node;
  title?(props: RouteProps): string;
};
