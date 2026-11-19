import type { KeyValueStorage } from "@keel/ctx";
import type { Chan } from "./Chan.ts";

const chans = new WeakMap<KeyValueStorage, Map<string, Chan>>();

/** The one `Chan` of `key` in `storage`, shared by every queue object and runner of this process. */
export function chanOf(storage: KeyValueStorage, key: string): Chan {
  const byKey = chans.get(storage) ?? new Map<string, Chan>();
  chans.set(storage, byKey);
  const c = byKey.get(key) ?? { tail: Promise.resolve(), v: 0, wake: new Set<() => void>() };
  byKey.set(key, c);
  return c;
}
