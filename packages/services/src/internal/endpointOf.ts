import { type Schema, isSchema } from "@keel/schema";
import type { Endpoint } from "../Endpoint.ts";
import type { Method } from "../Method.ts";

const METHODS: readonly Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];
const INPUTS = ["params", "query", "body"] as const;

/**
 * A contract entry as an API entry (k.contract): a `method`, a `path` and an `output` schema, with `params`, `query`
 * and `body` schemas, `errors` schemas, a `timeout` and `events` where present; `undefined` for any other value.
 */
export function endpointOf(v: unknown): Endpoint | undefined {
  if (typeof v !== "object" || v === null) return undefined;
  if (!("method" in v) || !("path" in v) || !("output" in v)) return undefined;
  const { method: m, path, output } = v;
  const method = METHODS.find((x) => x === m);
  if (method === undefined || typeof path !== "string" || !isSchema(output)) return undefined;
  const inputs: { [K in (typeof INPUTS)[number]]?: Schema<unknown, boolean> } = {};
  for (const k of INPUTS) {
    const s = k in v ? Object.getOwnPropertyDescriptor(v, k)?.value : undefined;
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
