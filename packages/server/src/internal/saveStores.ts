import type { KeelError } from "@keel/schema";
import type { Opened } from "./Opened.ts";
import type { RequestScope } from "./RequestScope.ts";
import type { Served } from "./Served.ts";
import { inOrder } from "./inOrder.ts";

type Conflict = KeelError<"keel.conflict", { store: string }>;
type Changed = { readonly o: Opened; readonly raw: string };

/** Check, then write: each key's in-process copy is replaced only after its `ctx.storage.set` resolves. */
async function commit(sv: Served, changed: readonly Changed[]): Promise<Conflict | null> {
  const stale = changed.find((c) => sv.saved.get(c.o.key) !== c.o.from);
  if (stale !== undefined) {
    const store = stale.o.store.id;
    return { code: "keel.conflict", message: `store ${store} changed since this request read it`, data: { store } };
  }
  const wrote = await Promise.allSettled(
    changed.map(async (c) => {
      await sv.ctx.storage.set(c.o.key, c.raw);
      sv.saved.set(c.o.key, { raw: c.raw });
    }),
  );
  for (const w of wrote) if (w.status === "rejected") throw w.reason;
  return null;
}

/**
 * After an action's `ok` (k.server Server state): save every factory store of the request whose snapshot changed to
 * `ctx.storage`, then to the in-process copy. When another request saved one of them after this one restored it,
 * nothing is saved and the result is `keel.conflict`. Saves touching a shared key run one at a time in issue order
 * (`inOrder`, `sv.saving`), so the check and the writes are one step and writes land in order. A rejected `set`
 * rejects the save (the action's 500) and leaves that key's copy as it was, so no later save carries the rejected
 * write; a key whose `set` resolved keeps its new copy (copy and storage agree per key; a multi-store save is not
 * atomic across keys).
 */
export async function saveStores(sv: Served, rq: RequestScope): Promise<Conflict | null> {
  const changed: Changed[] = [];
  for (const h of await Promise.all(rq.held.values()))
    for (const o of h.opened) {
      const raw = JSON.stringify(o.store.snapshot({ meta: true }));
      if (raw !== o.before) changed.push({ o, raw });
    }
  if (changed.length === 0) return null;
  return inOrder(
    sv.saving,
    changed.map((c) => c.o.key),
    () => commit(sv, changed),
  );
}
