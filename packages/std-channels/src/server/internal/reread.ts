import { attempt, s } from "@keel/schema";
import { Rejected } from "../../internal/Rejected.schema.ts";
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
    const snapshot = s.json.parseJson(raw);
    if (!snapshot.ok) return false;
    const restored = attempt(
      () => st.restore(snapshot.value).ok,
      (x) => (x instanceof Error ? Rejected.make({}) : undefined),
    );
    if (!restored.ok || !restored.value) return false;
  }
  return true;
}
