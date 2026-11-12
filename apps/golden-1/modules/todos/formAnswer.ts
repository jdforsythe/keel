import type { Ctx } from "@keel/ctx";
import { type KeelError, type Result, err, ok } from "@keel/schema";
import { type OutboxResult, resolve } from "@keel/std-offline";
import { WriteRefusal } from "./WriteRefusal.schema.ts";
import { boardOutbox } from "./boardOutbox.ts";

/**
 * What a Form action answers after sending through `boardOutbox`: `ok(null)` once the write is sent, queued or held as
 * a conflict (the outbox panel shows the last two). A failed write leaves the outbox, since the Form shows it: a 422's
 * `keel.fields` goes to its fields, any other error to the Form.
 */
export async function formAnswer<O>(
  ctx: Ctx,
  endpoint: string,
  r: OutboxResult<O>,
): Promise<Result<null, KeelError<string, unknown>>> {
  if (r.state !== "failed") return ok(null);
  const entry = boardOutbox
    .get("entries")
    .filter((e) => e.state === "failed" && e.endpoint === endpoint)
    .at(-1);
  if (entry !== undefined) await resolve(ctx, boardOutbox, entry.key, "theirs");
  const e = r.error;
  const refusal = e.code === "api.status" ? WriteRefusal.parse(e.data.body) : undefined;
  return err(refusal?.ok === true ? refusal.value.error : e);
}
