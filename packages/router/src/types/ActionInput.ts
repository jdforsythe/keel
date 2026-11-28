import type { Secret } from "@keel/schema";
import type { RouteTable } from "./RouteTable.ts";

/**
 * What an action's `run` gets beside its input (k.server): the matched `params`, the absolute request `url`, the
 * request's `caller`, its `user` and `bearer` (both optional for a direct caller) and its `stores` instance; absent,
 * `fn` gets what the declared factory returns for the ctx, `undefined` without one; `routes` is the table the request is
 * served from, absent `routeTable()`, on which every `pageHref` read is refused.
 */
export type ActionInput = {
  readonly params: unknown;
  readonly url: string;
  readonly caller: string;
  readonly user?: string;
  readonly bearer?: Secret<string> | undefined;
  readonly stores?: unknown;
  readonly routes?: RouteTable;
};
