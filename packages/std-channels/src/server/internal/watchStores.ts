import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
import type { Hub } from "./Hub.ts";
import type { StoreWatch } from "./StoreWatch.ts";
import { remoteSaves } from "./remoteSaves.ts";

/** How long a stream waits on `ctx.clock` for the storage watch to be listening. */
const LISTEN_MS = 5_000;

/**
 * Holds the hub's one watch on `ctx.storage` (k.persist Watch) for a stream of a route with `stores`, starting it with the
 * first holder: resolves the release once it is listening, which stops the watch with the last; `lost` runs when the watch
 * reports `lost` or a read of a reported key fails. Resolves a no-op release when the storage has no `watch`, and `undefined`
 * when the watch refused or was not listening within 5,000 ms on `ctx.clock`.
 */
export async function watchStores(ctx: Ctx, hub: Hub, lost: () => void): Promise<(() => void) | undefined> {
  const { storage } = ctx;
  if (storage.watch === undefined) return () => undefined;
  let watch = hub.watch;
  if (watch === undefined) {
    const holders = new Set<() => void>();
    const made: StoreWatch = {
      stop: undefined,
      holders,
      ready: Promise.resolve(false),
    };
    const started = storage.watch((report) => {
      if (report.kind === "committed") {
        remoteSaves(ctx, hub, report.keys);
        return;
      }
      if (hub.watch === made) hub.watch = undefined;
      const gone = [...holders];
      holders.clear();
      for (const f of gone) f();
    });
    made.ready = attempt(() => started).then((got) => {
      if (!got.ok) return false;
      made.stop = got.value;
      return true;
    });
    hub.watch = made;
    watch = made;
  }
  const mine = watch;
  mine.holders.add(lost);
  const release = (): void => {
    mine.holders.delete(lost);
    if (mine.holders.size > 0) return;
    if (hub.watch === mine) hub.watch = undefined;
    void mine.ready.then((ok) => {
      if (ok && mine.holders.size === 0) mine.stop?.();
    });
  };
  const timer = new AbortController();
  const late = attempt(() => ctx.clock.after(LISTEN_MS, timer.signal)).then(() => "late" as const);
  const won = await Promise.race([mine.ready.then((ok) => (ok ? "on" : "refused")), late]);
  timer.abort();
  if (won === "on") return release;
  release();
  return undefined;
}
