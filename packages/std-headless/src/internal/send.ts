import { defect } from "@keel/schema";
import { type Transaction, tx } from "@keel/store";

/**
 * Sends an event the widget built to its own chart. An event with no target leaves the state as it is, so a refusal
 * (a payload off its schema, an invariant) is a bug in the widget: a defect, never a value a caller handles.
 */
export function send<T, P>(t: Transaction<T, P>, payload: NoInfer<P>): void {
  const r = tx(t, payload);
  if (!r.ok) defect("std.headless: a chart event was refused", { data: { code: r.error.code }, cause: r.error });
}
