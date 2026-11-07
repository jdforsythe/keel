import { scope } from "@keel/reactive";
import { isolate, stores } from "@keel/store";
import type { Factory } from "./Factory.ts";
import type { Held } from "./Held.ts";
import type { RequestScope } from "./RequestScope.ts";
import type { Saved } from "./Saved.ts";
import type { Served } from "./Served.ts";
import { inOrder } from "./inOrder.ts";
import { savedOf } from "./savedOf.ts";

const DEFAULT_ID = /^store\.\d+$/;

/** The in-process copy of `key`, read from `ctx.storage` (and parsed) on first use. Called inside an `inOrder` section. */
async function load(sv: Served, key: string): Promise<Saved> {
  const hit = sv.saved.get(key);
  if (hit !== undefined) return hit;
  const now = savedOf(await sv.ctx.storage.get(key));
  sv.saved.set(key, now);
  return now;
}

async function open(sv: Served, rq: RequestScope, factory: Factory): Promise<Held> {
  const sc = rq.scope.run(() => scope(() => undefined));
  isolate(sc);
  const value = sc.run(() => factory(sv.ctx));
  const list = [...sc.run(stores).values()];
  for (const st of list)
    if (DEFAULT_ID.test(st.id)) throw new Error(`store ${st.id}: a stores factory's stores need an explicit id`);
  const named = list.map((store) => ({ store, key: `keel.store.${store.id}` }));
  // One section over all the factory's keys (RFC 0054): it starts after every save queued on any of them settles and
  // no later save of them lands before it ends, so the request reads every store as of the same saves.
  const loaded = await inOrder(
    sv.saving,
    named.map((n) => n.key),
    () => Promise.all(named.map(async (n) => ({ ...n, from: await load(sv, n.key) }))),
  );
  const opened = loaded.map(({ store, key, from }) => {
    if (from.json !== null) {
      const back = store.restore(from.json);
      if (!back.ok) throw new Error(`store ${store.id}: saved snapshot does not restore: ${back.error.message}`);
    }
    return { store, key, from, before: JSON.stringify(store.snapshot({ meta: true })) };
  });
  return { value, opened };
}

/**
 * This request's instance of `factory` (k.server Server state, RFC 0044): on first use the factory runs once in a
 * child scope of the request scope with its own registry, and each store it created is restored from `ctx.storage`
 * key `keel.store.<id>` (`snapshot({ meta: true })` JSON), all keys read in one `inOrder` section so they are one cut
 * (RFC 0054). A store with a default id (`store.<n>`) throws: its key would change every request.
 */
export function openStores(sv: Served, rq: RequestScope, factory: Factory): Promise<unknown> {
  const held = rq.held.get(factory) ?? open(sv, rq, factory);
  rq.held.set(factory, held);
  return held.then((h) => h.value);
}
