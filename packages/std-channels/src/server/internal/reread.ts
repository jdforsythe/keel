import { s } from "@keel/schema";
import type { Restorable } from "./Restorable.ts";

/**
 * Restore each of `list` from its stored snapshot (k.server Server state: `ctx.storage` `keel.store.<id>`), so a
 * stream's `member` reads the stores as of the latest save. False when a stored snapshot does not restore. A throw of
 * `read` or of a restore is the caller's: the stream's supervised member check takes it as a denial.
 */
export async function reread(
  list: readonly Restorable[],
  read: (key: string) => Promise<string | null>,
): Promise<boolean> {
  for (const st of list) {
    const raw = await read(`keel.store.${st.id}`);
    if (raw === null) continue;
    const snapshot = s.json.parseJson(raw);
    if (!snapshot.ok) return false;
    if (!st.restore(snapshot.value).ok) return false;
  }
  return true;
}
