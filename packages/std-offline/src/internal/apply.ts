import { defect } from "@keel/schema";
import { type Transaction, tx } from "@keel/store";

/**
 * Runs one of the outbox's own transactions with a payload the outbox built. Its transactions hold no invariant and
 * refuse no base, so a refusal is a bug in the outbox: a defect, never a value a caller handles.
 */
export function apply<T, P>(t: Transaction<T, P>, payload: NoInfer<P>): void;
export function apply<T, A>(t: Transaction<T, unknown>, payload: unknown extends A ? A : never): void;
export function apply<T>(t: Transaction<T, unknown>, payload: unknown): void {
  const r = tx(t, payload);
  if (!r.ok) defect("std.offline: an outbox transaction was refused", { data: { code: r.error.code }, cause: r.error });
}
