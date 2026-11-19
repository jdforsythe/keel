import type { Result } from "@keel/schema";
import type { ApiError } from "@keel/services";
import type { OutboxResult } from "../OutboxResult.ts";
import { field } from "./field.ts";

/**
 * How one answer of the module's service settles its entry (std.offline Flush): `ok` is `sent` with the decoded value;
 * `api.network` (a 502 `keel.unreachable` among them) and `api.timeout` are `queued`; a 409 whose error names a string
 * `data.transaction` and a number `data.head` is `conflict` at that head, any other 409 `undefined` (send it once more)
 * unless `retried`; an error body whose `code` is `offline.owner` is `refused`, and one whose `code` is `offline.signin`
 * is `paused`, whatever its status; anything else is `failed` with the `ApiError`.
 */
export function outcomeOf(
  r: Result<unknown, ApiError>,
  retried: boolean,
  refused: OutboxResult<unknown>,
  paused: OutboxResult<unknown>,
): OutboxResult<unknown> | undefined {
  if (r.ok) return { state: "sent", value: r.value };
  const x = r.error;
  if (x.code === "api.network" || x.code === "api.timeout") return { state: "queued" };
  if (field(x.data.body, "code") === "offline.owner") return refused;
  if (field(x.data.body, "code") === "offline.signin") return paused;
  if (x.data.status === 409) {
    const data = field(x.data.body, "data");
    const head = field(data, "head");
    if (typeof field(data, "transaction") === "string" && typeof head === "number") return { state: "conflict", head };
    if (!retried) return undefined;
  }
  return { state: "failed", error: x };
}
