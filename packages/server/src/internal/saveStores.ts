import type { KeelError } from "@keel/schema";
import type { Opened } from "./Opened.ts";
import type { RequestScope } from "./RequestScope.ts";
import type { Served } from "./Served.ts";

/**
 * After an action's `ok` (k.server Server state): save every factory store of the request whose snapshot changed, to
 * the in-process copy and `ctx.storage`. When another request saved one of them after this one restored it, nothing
 * is saved and the result is `keel.conflict`. The check and the in-process update are one synchronous step.
 */
export async function saveStores(
  sv: Served,
  rq: RequestScope,
): Promise<KeelError<"keel.conflict", { store: string }> | null> {
  const changed: { readonly o: Opened; readonly raw: string }[] = [];
  for (const h of await Promise.all(rq.held.values()))
    for (const o of h.opened) {
      const raw = JSON.stringify(o.store.snapshot({ meta: true }));
      if (raw !== o.before) changed.push({ o, raw });
    }
  const stale = changed.find((c) => sv.saved.get(c.o.key) !== c.o.from);
  if (stale !== undefined) {
    const store = stale.o.store.id;
    return { code: "keel.conflict", message: `store ${store} changed since this request read it`, data: { store } };
  }
  for (const c of changed) sv.saved.set(c.o.key, { raw: c.raw });
  await Promise.all(changed.map((c) => sv.ctx.storage.set(c.o.key, c.raw)));
  return null;
}
