import { scope } from "@keel/reactive";
import { isolate, stores } from "@keel/store";
import type { Factory } from "./Factory.ts";
import type { Held } from "./Held.ts";
import type { Opened } from "./Opened.ts";
import type { RequestScope } from "./RequestScope.ts";
import type { Saved } from "./Saved.ts";
import type { Served } from "./Served.ts";

const DEFAULT_ID = /^store\.\d+$/;

/**
 * The in-process copy of `key`, read from `ctx.storage` on first use (a concurrent first read keeps the earlier copy).
 * A save of `key` still in flight is awaited first, so a read never sees a copy its storage write may yet reject.
 */
async function load(sv: Served, key: string): Promise<Saved> {
  await sv.saving.get(key);
  const hit = sv.saved.get(key);
  if (hit !== undefined) return hit;
  const raw = await sv.ctx.storage.get(key);
  const now = sv.saved.get(key) ?? { raw };
  sv.saved.set(key, now);
  return now;
}

async function open(sv: Served, rq: RequestScope, factory: Factory): Promise<Held> {
  const sc = rq.scope.run(() => scope(() => undefined));
  isolate(sc);
  const value = sc.run(() => factory(sv.ctx));
  const opened: Opened[] = [];
  for (const st of sc.run(stores).values()) {
    if (DEFAULT_ID.test(st.id)) throw new Error(`store ${st.id}: a stores factory's stores need an explicit id`);
    const key = `keel.store.${st.id}`;
    const from = await load(sv, key);
    if (from.raw !== null) {
      const json: unknown = JSON.parse(from.raw);
      const back = st.restore(json);
      if (!back.ok) throw new Error(`store ${st.id}: saved snapshot does not restore: ${back.error.message}`);
    }
    opened.push({ store: st, key, from, before: JSON.stringify(st.snapshot({ meta: true })) });
  }
  return { value, opened };
}

/**
 * This request's instance of `factory` (k.server Server state, RFC 0044): on first use the factory runs once in a
 * child scope of the request scope with its own registry, and each store it created is restored from `ctx.storage`
 * key `keel.store.<id>` (`snapshot({ meta: true })` JSON). A store with a default id (`store.<n>`) throws: its key
 * would change every request.
 */
export function openStores(sv: Served, rq: RequestScope, factory: Factory): Promise<unknown> {
  const held = rq.held.get(factory) ?? open(sv, rq, factory);
  rq.held.set(factory, held);
  return held.then((h) => h.value);
}
