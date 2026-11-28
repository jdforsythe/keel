import type { KeyValueStorage } from "@keel/ctx";
import { heldMap } from "@keel/schema/internal";
import type { SavedCopy } from "./types/SavedCopy.ts";

const copies = heldMap<KeyValueStorage, SavedCopy>();

/** The in-process copy of `storage` (k.persist Server saves): one per storage object, shared by every `createApp` over it. */
export function copyOf(storage: KeyValueStorage): SavedCopy {
  const hit = copies.get(storage);
  if (hit !== undefined) return hit;
  const made: SavedCopy = { saved: new Map() };
  copies.set(storage, made);
  return made;
}
