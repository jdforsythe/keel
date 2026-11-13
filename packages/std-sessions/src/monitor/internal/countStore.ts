import type { Ctx } from "@keel/ctx";
import { Logged } from "./Logged.schema.ts";

/**
 * Add to `counts` one run per entry of store `store`'s stored log whose `id` is above `heads`' entry for it (0 when
 * absent), keyed by the entry's `name`, and move that head to the highest `id` read. Only `id` and `name` are kept.
 */
export async function countStore(
  ctx: Ctx,
  store: string,
  heads: Map<string, number>,
  counts: Map<string, number>,
): Promise<void> {
  const raw = await ctx.storage.get(`keel.store.${store}`);
  if (raw === null) return;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return;
  }
  const parsed = Logged.parse(value);
  if (!parsed.ok) return;
  const last = heads.get(store) ?? 0;
  let top = last;
  for (const e of parsed.value.log) {
    if (e.id <= last) continue;
    counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
    if (e.id > top) top = e.id;
  }
  heads.set(store, top);
}
