import { type Ctx, observe } from "@keel/ctx";
import type { Hub } from "./Hub.ts";
import type { Sink } from "./Sink.ts";
import { withinRead } from "./withinRead.ts";

/**
 * Add `sink` to `hub`; returns its removal. While any sink is open the hub observes `ctx` and hands each
 * `{ kind: 'save', store, head }` to every sink, in report order, with a read of `ctx.storage` shared per save and
 * bounded at 5,000 ms on `ctx.clock` (`undefined` past it).
 */
export function join(ctx: Ctx, hub: Hub, sink: Sink): () => void {
  hub.sinks.add(sink);
  hub.stop ??= observe(ctx, (e) => {
    if (e.kind !== "save") return;
    const reads = new Map<string, Promise<string | null | undefined>>();
    const read = (key: string): Promise<string | null | undefined> => {
      const hit = reads.get(key) ?? withinRead(ctx, ctx.storage.get(key));
      reads.set(key, hit);
      return hit;
    };
    for (const s of [...hub.sinks]) s.saved(e.store, e.head, read);
  });
  return () => {
    hub.sinks.delete(sink);
    if (hub.sinks.size > 0) return;
    hub.stop?.();
    hub.stop = undefined;
  };
}
