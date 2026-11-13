import type { Ctx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import type { Schema } from "@keel/schema";
import { isolate } from "../isolate.ts";
import { stores } from "../stores.ts";
import { copyOf } from "./copyOf.ts";
import { inOrder } from "./inOrder.ts";
import { savedOf } from "./savedOf.ts";
import type { Factory } from "./types/Factory.ts";
import type { Held } from "./types/Held.ts";
import type { Saved } from "./types/Saved.ts";
import type { SavedCopy } from "./types/SavedCopy.ts";
import type { StateRequest } from "./types/StateRequest.ts";

const DEFAULT_ID = /^store\.\d+$/;

/** The in-process copy of `key`, read from `ctx.storage` (and parsed) on first use. Called inside an `inOrder` section. */
async function load(ctx: Ctx, copy: SavedCopy, key: string): Promise<Saved> {
  const hit = copy.saved.get(key);
  if (hit !== undefined) return hit;
  const now = savedOf(await ctx.storage.get(key));
  copy.saved.set(key, now);
  return now;
}

async function open(
  ctx: Ctx,
  rq: StateRequest,
  factory: Factory,
  seen: ((schema: Schema<unknown>, state: unknown) => void) | undefined,
): Promise<Held> {
  const copy = copyOf(ctx.storage);
  const sc = rq.scope.run(() => scope(() => undefined));
  isolate(sc);
  const value = sc.run(() => factory(ctx));
  const list = [...sc.run(stores).values()];
  for (const st of list)
    if (DEFAULT_ID.test(st.id)) throw new Error(`store ${st.id}: a stores factory's stores need an explicit id`);
  const named = list.map((store) => ({ store, key: `keel.store.${store.id}` }));
  // One section over all the factory's keys: it starts after every save queued on any of them settles and no later
  // save of them lands before it ends, so the request reads every store as of the same saves.
  const loaded = await inOrder(
    copy.saving,
    named.map((n) => n.key),
    () => Promise.all(named.map(async (n) => ({ ...n, from: await load(ctx, copy, n.key) }))),
  );
  const opened = loaded.map(({ store, key, from }) => {
    if (from.json !== null) {
      const back = store.restore(from.json);
      if (!back.ok) throw new Error(`store ${store.id}: saved snapshot does not restore: ${back.error.message}`);
    }
    const snap = store.snapshot({ meta: true });
    seen?.(store.schema, snap.state);
    return { store, key, from, before: JSON.stringify(snap) };
  });
  return { value, opened };
}

/**
 * This request's instance of `factory` (k.server Server state): on first use the factory runs once with `ctx` in a
 * child scope of the request scope with its own registry, and each store it created is restored from `ctx.storage`
 * key `keel.store.<id>` (`snapshot({ meta: true })` JSON) through the storage's copy (`copyOf`), all keys read in one
 * `inOrder` section so they are one cut; `seen` gets each restored store's schema and state. A store with a default id
 * (`store.<n>`) throws: its key would change every request.
 */
export function openStores(
  ctx: Ctx,
  rq: StateRequest,
  factory: Factory,
  seen?: (schema: Schema<unknown>, state: unknown) => void,
): Promise<unknown> {
  const held = rq.held.get(factory) ?? open(ctx, rq, factory, seen);
  rq.held.set(factory, held);
  return held.then((h) => h.value);
}
