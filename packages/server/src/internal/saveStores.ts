import { report } from "@keel/ctx/internal";
import type { KeelError } from "@keel/schema";
import type { Opened } from "./Opened.ts";
import type { RequestScope } from "./RequestScope.ts";
import type { Served } from "./Served.ts";
import { inOrder } from "./inOrder.ts";
import { savedOf } from "./savedOf.ts";

type Conflict = KeelError<"keel.conflict", { store: string }>;
type Changed = { readonly o: Opened; readonly raw: string };

/**
 * Check, then write: every opened key (the read set, RFC 0054) must still hold the copy it was restored from, else
 * `keel.conflict`; each changed key's in-process copy is replaced only after its `ctx.storage.set` resolves. Once every
 * write is stored, each changed store is reported to `observe` as `save` with its head, in save order.
 */
async function commit(sv: Served, opened: readonly Opened[], changed: readonly Changed[]): Promise<Conflict | null> {
  const stale = opened.find((o) => sv.saved.get(o.key) !== o.from);
  if (stale !== undefined) {
    const store = stale.store.id;
    return { code: "keel.conflict", message: `store ${store} changed since this request read it`, data: { store } };
  }
  const wrote = await Promise.allSettled(
    changed.map(async (c) => {
      await sv.ctx.storage.set(c.o.key, c.raw);
      sv.saved.set(c.o.key, savedOf(c.raw));
    }),
  );
  for (const w of wrote) if (w.status === "rejected") throw w.reason;
  for (const c of changed) report(sv.ctx, { kind: "save", store: c.o.store.id, head: c.o.store.head() });
  return null;
}

/**
 * After an action's `ok` (k.server Server state): save every factory store of the request whose snapshot changed to
 * `ctx.storage`, then to the in-process copy. When another request saved any store this one opened (changed or only
 * read) after this one restored it, nothing is saved and the result is `keel.conflict` (RFC 0054: no write skew; the
 * opened stores are the read set). Loads and saves touching a shared key run one at a time in issue order (`inOrder`,
 * `sv.saving`), so the check and the writes are one step and writes land in order. A rejected `set` rejects the save
 * (the action's 500) and leaves that key's copy as it was, so no later save carries the rejected write; a key whose
 * `set` resolved keeps its new copy (copy and storage agree per key; a multi-store save is not atomic across keys).
 * Nothing changed: nothing to check, since the action's reads were one cut (`openStores`).
 */
export async function saveStores(sv: Served, rq: RequestScope): Promise<Conflict | null> {
  const opened: Opened[] = [];
  const changed: Changed[] = [];
  for (const h of await Promise.all(rq.held.values()))
    for (const o of h.opened) {
      opened.push(o);
      const raw = JSON.stringify(o.store.snapshot({ meta: true }));
      if (raw !== o.before) changed.push({ o, raw });
    }
  if (changed.length === 0) return null;
  return inOrder(sv.saving, [...new Set(opened.map((o) => o.key))], () => commit(sv, opened, changed));
}
