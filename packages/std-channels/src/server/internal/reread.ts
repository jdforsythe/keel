import type { Restorable } from "./Restorable.ts";

/**
 * Restore each of `list` from its stored snapshot (k.server Server state: `ctx.storage` `keel.store.<id>`), so a
 * stream's `member` reads the stores as of the latest save. False when a stored snapshot does not restore.
 */
export async function reread(
  list: readonly Restorable[],
  read: (key: string) => Promise<string | null>,
): Promise<boolean> {
  for (const st of list) {
    const raw = await read(`keel.store.${st.id}`);
    if (raw === null) continue;
    try {
      const json: unknown = JSON.parse(raw);
      if (!st.restore(json).ok) return false;
    } catch {
      return false;
    }
  }
  return true;
}
