import type { Ctx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { type Schema, defect } from "@keel/schema";
import { isolate } from "../isolate.ts";
import { stores } from "../stores.ts";
import { copyOf } from "./copyOf.ts";
import { requestIds } from "./requestIds.ts";
import { savedOf } from "./savedOf.ts";
import type { Factory } from "./types/Factory.ts";
import type { Held } from "./types/Held.ts";
import type { StateRequest } from "./types/StateRequest.ts";

const DEFAULT_ID = /^store\.\d+$/;

/**
 * Run `factory` once with `ctx` in a child scope of the request scope with its own registry and restore each store it
 * created from one `ctx.storage.read` of their keys `keel.store.<id>` (k.persist Server saves), so the request reads
 * every store as of one cut. A value equal to the copy's (`copyOf`) reuses its parse. `seen` gets each restored
 * store's schema and state. A store with a default id (`store.<n>`) throws: its key would change every request; so does
 * one whose id another factory still held by this request opened (k.store: one id, one live store per request scope).
 */
async function restoreAll<S>(
  ctx: Ctx,
  rq: StateRequest,
  factory: (ctx: Ctx) => S,
  seen?: (schema: Schema<unknown>, state: unknown) => void,
): Promise<Held<S>> {
  const copy = copyOf(ctx.storage);
  const sc = rq.scope.run(() => scope(() => undefined));
  isolate(sc);
  const value = sc.run(() => factory(ctx));
  const list = [...sc.run(stores).values()];
  for (const st of list)
    if (DEFAULT_ID.test(st.id)) throw new Error(`store ${st.id}: a stores factory's stores need an explicit id`);
  const ids = requestIds.get(rq.scope) ?? new Map<string, Factory>();
  requestIds.set(rq.scope, ids);
  for (const st of list) {
    const by = ids.get(st.id);
    if (by !== undefined && rq.held.has(by)) throw new Error(`store ${st.id}: id already in use by a live store`);
  }
  for (const st of list) ids.set(st.id, factory);
  const keys = list.map((store) => `keel.store.${store.id}`);
  const raws = await ctx.storage.read(keys);
  const opened = list.map((store, i) => {
    const key = keys[i] ?? "";
    const raw = raws[i] ?? null;
    const hit = copy.saved.get(key);
    const from = hit?.raw === raw ? hit : savedOf(raw);
    copy.saved.set(key, from);
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

const member = (x: unknown, key: string): unknown =>
  typeof x === "object" && x !== null ? Reflect.get(x, key) : undefined;

/**
 * Open `factory` on the request (k.persist Server saves): its instance is registered in `rq.held` before it resolves,
 * so `saveStores` saves it. A caller that needs the factory's own type (`commitStores`) opens on a fresh request.
 * Arguments of the wrong kind are a defect raised before any work starts, so no promise is left unread (k.defects).
 */
export function openHeld<S>(
  ctx: Ctx,
  rq: StateRequest,
  factory: (ctx: Ctx) => S,
  seen?: (schema: Schema<unknown>, state: unknown) => void,
): Promise<Held<S>> {
  const given: unknown[] = [ctx, rq, factory, seen];
  const [c, r, f, w] = given;
  const fits =
    typeof member(member(c, "storage"), "read") === "function" &&
    member(r, "held") instanceof Map &&
    typeof member(member(r, "scope"), "run") === "function" &&
    typeof f === "function" &&
    (w === undefined || typeof w === "function");
  if (!fits) defect("openHeld takes a ctx with storage, a state request and a stores factory");
  const held = restoreAll(ctx, rq, factory, seen);
  rq.held.set(factory, held);
  return held;
}
