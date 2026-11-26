import { type Schema, isSchema } from "@keel/schema";
import type { Endpoint } from "@keel/services";

const WRITES = ["POST", "PUT", "PATCH", "DELETE"] as const;
const INPUTS = ["params", "query", "body"] as const;

/**
 * A contract entry as an API write entry (std.offline): a `method` other than `GET`, a `path`, an `output` schema and,
 * where present, `params`, `query`, `body` and `errors` schemas, a `timeout` and `events`; `undefined` for any other
 * entry.
 */
export function writeOf(v: object): Endpoint | undefined {
  if (!("method" in v) || !("path" in v) || !("output" in v)) return undefined;
  const { method: m, path, output } = v;
  const method = WRITES.find((x) => x === m);
  if (method === undefined || typeof path !== "string" || !isSchema(output)) return undefined;
  const inputs: { [K in (typeof INPUTS)[number]]?: Schema<unknown, boolean> } = {};
  for (const k of INPUTS) {
    const s = Object.getOwnPropertyDescriptor(v, k)?.value;
    if (s === undefined) continue;
    if (!isSchema(s)) return undefined;
    inputs[k] = s;
  }
  const raw = "errors" in v ? v.errors : undefined;
  let errors: Record<number, Schema<unknown, boolean>> | undefined;
  if (raw !== undefined) {
    if (typeof raw !== "object" || raw === null) return undefined;
    errors = {};
    for (const [status, s] of Object.entries(raw)) {
      if (!isSchema(s)) return undefined;
      errors[Number(status)] = s;
    }
  }
  const timeout = "timeout" in v ? v.timeout : undefined;
  const events = "events" in v ? v.events : undefined;
  if (timeout !== undefined && typeof timeout !== "number") return undefined;
  if (events !== undefined && typeof events !== "boolean") return undefined;
  return {
    method,
    path,
    output,
    ...inputs,
    ...(errors === undefined ? {} : { errors }),
    ...(timeout === undefined ? {} : { timeout }),
    ...(events === undefined ? {} : { events }),
  };
}
