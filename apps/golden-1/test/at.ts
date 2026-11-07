import type { Schema } from "@keel/schema";

/** `{ params, url }` as the router passes them: `value` parsed by the route's `params` schema, `url` the test page's. */
export function at<T>(params: Schema<T>, value: unknown): { readonly params: T; readonly url: string } {
  const r = params.parse(value);
  if (!r.ok) throw new Error(`route params do not parse: ${JSON.stringify(value)}`);
  return { params: r.value, url: location.href };
}
