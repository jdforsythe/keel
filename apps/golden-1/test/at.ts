import type { Schema } from "@keel/schema";
import { Board } from "../modules/todos/Board.schema.ts";

/** A `Board` from plain fixtures: their ids parse into the branded ones. */
export const boardOf = (raw: unknown): Board => {
  const r = Board.parse(raw);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

/**
 * `{ params, url, caller, stores }` as the router passes them: `value` parsed by the route's `params` schema, `url` the
 * test page's. Loaders and actions off the node deployable have no stores; spread another `caller`/`stores` over it.
 */
export function at<T>(
  params: Schema<T>,
  value: unknown,
): { readonly params: T; readonly url: string; readonly caller: string; readonly stores: undefined } {
  const r = params.parse(value);
  if (!r.ok) throw new Error(`route params do not parse: ${JSON.stringify(value)}`);
  return { params: r.value, url: location.href, caller: "c1", stores: undefined };
}
