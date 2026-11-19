import type { Result, Schema } from "@keel/schema";
import type { ApiError, Endpoint } from "@keel/services";
import type { OutboxResult } from "../OutboxResult.ts";
import { field } from "./field.ts";

/** `schema` over a route `Result`'s own part when that decodes, else over the whole body. */
const decode = (schema: Schema<unknown, boolean>, own: unknown, whole: unknown) => {
  const a = schema.parse(own);
  return a.ok ? a : schema.parse(whole);
};

/**
 * How one answer of endpoint `e`, its body read as JSON, settles its entry (std.offline Flush). The body is read as a
 * `module` service reads a route's `Result` (k.services): a 2xx `{ ok: true, value }` is `sent` with `value` decoded by
 * `output`; `api.network`, `api.timeout` and a 502 `keel.unreachable` err are `queued`; a 409 `keel.conflict` err naming `data.transaction` is `conflict` at
 * `data.head`, any other 409 `undefined` (send it once more) unless `retried`; anything else is `failed`, a status's
 * body the err's `error` decoded by `errors[status]` (else null). A schema that does not decode the `Result`'s part is
 * tried on the whole body, so a map whose schemas describe the whole k.server answer reads it too.
 */
export function outcomeOf(
  r: Result<unknown, ApiError>,
  retried: boolean,
  e: Endpoint,
): OutboxResult<unknown> | undefined {
  if (r.ok) {
    const out = decode(e.output, field(r.value, "ok") === true ? field(r.value, "value") : r.value, r.value);
    if (out.ok) return { state: "sent", value: out.value };
    return { state: "failed", error: { code: "api.decode", message: e.path, data: { issues: out.error.data.issues } } };
  }
  const x = r.error;
  if (x.code === "api.network" || x.code === "api.timeout") return { state: "queued" };
  if (x.code !== "api.status") return { state: "failed", error: x };
  const { status, body } = x.data;
  const error = field(body, "ok") === false ? field(body, "error") : body;
  const data = field(error, "data");
  const head = field(data, "head");
  if (status === 502 && field(error, "code") === "keel.unreachable") return { state: "queued" };
  if (status === 409 && typeof field(data, "transaction") === "string" && typeof head === "number")
    return { state: "conflict", head };
  if (status === 409 && !retried) return undefined;
  const schema = e.errors?.[status];
  const decoded = schema && decode(schema, error, body);
  return { state: "failed", error: { ...x, data: { status, body: decoded?.ok ? decoded.value : null } } };
}
