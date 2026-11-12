import { type Result, err, ok } from "@keel/schema";

const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);

/**
 * The route's own `Result` in a k.server answer: a GET's `results[id]` when the body is `{ id, results }`, else the
 * body itself (an action's answer, or an error answered before any loader ran). Undefined when it is not a `Result`.
 */
export function routeResult(body: unknown, get: boolean): Result<unknown, unknown> | undefined {
  const id = field(body, "id");
  const own = get && typeof id === "string" ? field(field(body, "results"), id) : body;
  const tag = field(own, "ok");
  if (tag === true) return ok(field(own, "value"));
  return tag === false ? err(field(own, "error")) : undefined;
}
