import type { Result } from "@keel/schema";
import type { ApiError } from "@keel/services";
import type { OutboxResult } from "../OutboxResult.ts";
import { field } from "./field.ts";

/**
 * How one answer settles its entry (std.offline Flush): 2xx `sent`; `api.network` or `api.timeout` `queued`; a 409
 * whose declared body is a `keel.conflict` err naming `data.transaction` `conflict` at `data.head`; any other 409
 * `undefined` (send it once more) unless `retried`; anything else `failed`.
 */
export function outcomeOf(r: Result<unknown, ApiError>, retried: boolean): OutboxResult<unknown> | undefined {
  if (r.ok) return { state: "sent", value: r.value };
  const e = r.error;
  if (e.code === "api.network" || e.code === "api.timeout") return { state: "queued" };
  if (e.data.status === 409) {
    const data = field(field(e.data.body, "error"), "data");
    const head = field(data, "head");
    if (typeof field(data, "transaction") === "string" && typeof head === "number") return { state: "conflict", head };
    if (!retried) return undefined;
  }
  return { state: "failed", error: e };
}
