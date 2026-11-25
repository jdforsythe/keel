import type { Ctx } from "@keel/ctx";
import { attempt, s } from "@keel/schema";

/** Whether `caller` is on the organizers' list: the JSON array under `ctx.storage` key `shifts.organizers`. */
export async function isOrganizer(ctx: Ctx, caller: string): Promise<boolean> {
  if (caller === "") return false;
  const stored = await ctx.storage.get("shifts.organizers");
  if (stored === null) return false;
  const json = attempt((): unknown => JSON.parse(stored));
  if (!json.ok) return false;
  const list = s.array(s.string()).parse(json.value);
  return list.ok && list.value.includes(caller);
}
