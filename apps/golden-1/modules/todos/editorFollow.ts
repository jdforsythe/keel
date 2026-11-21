import { type KeelError, type Result, ok } from "@keel/schema";
import { boardOutbox } from "./boardOutbox.ts";
import { editorChart } from "./editorChart.ts";
import { editorOutcome } from "./editorOutcome.ts";

/**
 * Brings `editorChart` up to the outbox: an edit the chart still holds in `saving` that the outbox has since sent
 * (no edit left in it) is `saved`, one it refused `refused`, one that failed `failed`; a queued or sending edit stays
 * `saving`. The outbox sends a queued edit, or one sent again by Keep mine, after the page that made it moved on.
 */
export function editorFollow(): Result<unknown, KeelError<string, unknown>> {
  if (editorChart.store.get("state") !== "saving") return ok(null);
  const edit = boardOutbox
    .get("entries")
    .filter((e) => e.endpoint === "editTodo")
    .at(-1);
  return editorOutcome(edit === undefined ? "sent" : edit.state);
}
