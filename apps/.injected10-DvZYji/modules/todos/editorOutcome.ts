import { type KeelError, type Result, ok } from "@keel/schema";
import type { OutboxEntry, OutboxResult } from "@keel/std-offline";
import { tx } from "@keel/store";
import { editorChart } from "./editorChart.ts";

/**
 * Moves `editorChart` by what the outbox did with an edit: sent is `saved`, a conflict `refused`, a failure `failed`.
 * A queued or sending edit leaves the chart in `saving` until the outbox sends it. Answers the chart's `tx` result.
 */
export function editorOutcome(
  state: OutboxResult<unknown>["state"] | OutboxEntry["state"],
): Result<unknown, KeelError<string, unknown>> {
  if (state === "sent") return tx(editorChart.events.saved, {});
  if (state === "conflict") return tx(editorChart.events.refused, {});
  if (state === "failed") return tx(editorChart.events.failed, {});
  return ok(null);
}
