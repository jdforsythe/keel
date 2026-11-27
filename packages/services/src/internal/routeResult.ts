const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);

/**
 * The route's own `Result` in a k.server answer: a GET's `results[id]` when the body is `{ id, results }`, else the
 * body itself (an action's answer, or an error answered before any loader ran). Undefined when it is not a `Result`.
 * The error is what the wire held, not yet decoded, so the answer is a plain `{ ok, value }` or `{ ok, error }`.
 */
export function routeResult(
  body: unknown,
  get: boolean,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: unknown } | undefined {
  const id = field(body, "id");
  const own = get && typeof id === "string" ? field(field(body, "results"), id) : body;
  const tag = field(own, "ok");
  if (tag === true) return { ok: true, value: field(own, "value") };
  return tag === false ? { ok: false, error: field(own, "error") } : undefined;
}
