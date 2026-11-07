import type { Schema } from "@keel/schema";

/** `{ params }` as the router passes them to a loader or action: `value` parsed by the route's `params` schema. */
export function at<T>(params: Schema<T>, value: unknown): { readonly params: T } {
  const r = params.parse(value);
  if (!r.ok) throw new Error(`route params do not parse: ${JSON.stringify(value)}`);
  return { params: r.value };
}
