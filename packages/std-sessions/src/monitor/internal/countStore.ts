import type { Ctx } from "@keel/ctx";
import { Logged } from "./Logged.schema.ts";

/**
 * Add to `counts` one run per entry of store `store`'s stored log with `from < id <= head` (the entries one save
 * committed), keyed by the entry's `name`. Only `id` and `name` are kept; entries folded out of the log are not counted.
 */
export async function countStore(
  ctx: Ctx,
  save: { readonly store: string; readonly from: number; readonly head: number },
  counts: Map<string, number>,
): Promise<void> {
  const raw = await ctx.storage.get(`keel.store.${save.store}`);
  if (raw === null) return;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return;
  }
  const parsed = Logged.parse(value);
  if (!parsed.ok) return;
  for (const e of parsed.value.log)
    if (e.id > save.from && e.id <= save.head) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
}
