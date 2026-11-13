import type { Saved } from "./Saved.ts";

/**
 * The in-process copy of one `ctx.storage` (`copyOf`): `saved`, each key a `stores` factory's store was restored from
 * or saved to, and `saving`, the settled tail of the last load or save queued on each such key (`inOrder`: loads and
 * saves of a key run in issue order).
 */
export type SavedCopy = {
  readonly saved: Map<string, Saved>;
  readonly saving: Map<string, Promise<void>>;
};
