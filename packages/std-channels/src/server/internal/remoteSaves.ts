import { type Ctx, supervise } from "@keel/ctx";
import { Rejected } from "../../internal/Rejected.schema.ts";
import type { Hub } from "./Hub.ts";
import { headOf } from "./headOf.ts";
import { withinRead } from "./withinRead.ts";

const PREFIX = "keel.store.";

/**
 * A `committed` report of `ctx.storage`'s watch (k.persist Watch): each named store key is read once, in the read the streams share,
 * and its `head` is handed to every open stream as a save of that store. A read that fails, or has not settled within
 * 5,000 ms on `ctx.clock`, ends the streams holding the watch
 * as a drop (their clients reopen and re-read); the read is supervised as `channels.storage` (k.supervise), so a rejection
 * of any value is reported once. Names no value.
 */
export function remoteSaves(ctx: Ctx, hub: Hub, keys: readonly string[]): void {
  const reads = new Map<string, Promise<string | null | undefined>>();
  const read = (key: string): Promise<string | null | undefined> => {
    const hit = reads.get(key) ?? withinRead(ctx, ctx.storage.get(key));
    reads.set(key, hit);
    return hit;
  };
  const watch = hub.watch;
  for (const key of keys) {
    if (!key.startsWith(PREFIX)) continue;
    const store = key.slice(PREFIX.length);
    const reading = read(key);
    void supervise(ctx, "channels.storage", () => reading, Rejected.make({})).then((got) => {
      if (!got.ok || got.value === undefined) {
        for (const lost of [...(watch?.holders ?? [])]) lost();
        return;
      }
      const head = headOf(got.value);
      if (head === undefined) return;
      for (const sink of [...hub.sinks]) sink.saved(store, head, read);
    });
  }
}
