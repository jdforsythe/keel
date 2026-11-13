import type { KeyValueStorage } from "@keel/ctx";
import type { SavedCopy } from "./types/SavedCopy.ts";

const copies = new WeakMap<KeyValueStorage, SavedCopy>();

/**
 * The in-process copy of `storage` (k.server Server state): one per storage object, so every `createApp` and harness
 * render over one `ctx.storage` reads and saves through the same copy and a stale save is `keel.conflict`.
 */
export function copyOf(storage: KeyValueStorage): SavedCopy {
  const hit = copies.get(storage);
  if (hit !== undefined) return hit;
  const made: SavedCopy = { saved: new Map(), saving: new Map() };
  copies.set(storage, made);
  return made;
}
