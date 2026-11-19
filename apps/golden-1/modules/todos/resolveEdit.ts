import type { Ctx } from "@keel/ctx";
import { type Resolution, resolve } from "@keel/std-offline";
import { tx } from "@keel/store";
import { boardOutbox } from "./boardOutbox.ts";
import { editorChart } from "./editorChart.ts";
import { editorFollow } from "./editorFollow.ts";
import { editorStuck } from "./editorStuck.ts";

/**
 * Keep mine or Keep theirs on a refused edit (`key` in `boardOutbox`), through `editorChart`: an edit still `saving`
 * learns of the refusal first (`refused`), then `mine` sends it again within the chart's 3 tries and `theirs` drops
 * it. Keep mine does nothing once the edit has used its tries (`editorStuck`); the outbox sends it again in the
 * background, and the chart follows its answer when it is known (`editorFollow`). Resolves true when the outbox
 * applied the choice, as `resolve` does.
 */
export async function resolveEdit(ctx: Ctx, key: string, resolution: Resolution): Promise<boolean> {
  const refused = tx(editorChart.events.refused, {});
  if (!refused.ok || (resolution === "mine" && editorStuck())) return false;
  const chosen = tx(resolution === "mine" ? editorChart.events.mine : editorChart.events.theirs, {});
  if (!chosen.ok) return false;
  const applied = await resolve(ctx, boardOutbox, key, resolution);
  return applied && editorFollow().ok;
}
