import type { Ctx } from "@keel/ctx";
import type { Hub } from "./Hub.ts";
import { headOf } from "./headOf.ts";

const PREFIX = "keel.store.";

/**
 * A `committed` report of `ctx.storage`'s watch (k.persist Watch): each named store key is read once, in the read the streams share,
 * and its `head` is handed to every open stream as a save of that store. A read that fails ends the streams holding the watch
 * as a drop (their clients reopen and re-read). Names no value.
 */
export function remoteSaves(ctx: Ctx, hub: Hub, keys: readonly string[]): void {
  const reads = new Map<string, Promise<string | null>>();
  const read = (key: string): Promise<string | null> => {
    const hit = reads.get(key) ?? ctx.storage.get(key);
    reads.set(key, hit);
    return hit;
  };
  const watch = hub.watch;
  for (const key of keys) {
    if (!key.startsWith(PREFIX)) continue;
    const store = key.slice(PREFIX.length);
    read(key).then(
      (raw) => {
        const head = headOf(raw);
        if (head === undefined) return;
        for (const sink of [...hub.sinks]) sink.saved(store, head, read);
      },
      () => {
        for (const lost of [...(watch?.holders ?? [])]) lost();
      },
    );
  }
}
