import { err, ok } from "@keel/schema";
import { job } from "@keel/std-jobs";
import { RecountInput } from "./RecountInput.schema.ts";
import { boardApi } from "./boardApi.ts";
import { writeLatest } from "./writeLatest.ts";

/**
 * Job `digest.recount`: read the board through the `api` module's `GET /api/lists`, count open and done todos, and
 * store them with the `ctx.clock` time. Idempotent: a rerun counts the board again.
 */
export const recount = job({ input: RecountInput }, async (_input, ctx, signal) => {
  const r = await boardApi.lists({ signal }, ctx);
  if (!r.ok) return err(r.error);
  const todos = r.value.todos;
  const done = todos.filter((t) => t.done).length;
  await writeLatest(ctx, { open: todos.length - done, done, at: ctx.clock.now() });
  return ok(null);
});
