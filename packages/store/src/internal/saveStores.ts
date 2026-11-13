import type { Ctx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { copyOf } from "./copyOf.ts";
import { inOrder } from "./inOrder.ts";
import { savedOf } from "./savedOf.ts";
import type { Opened } from "./types/Opened.ts";
import type { SaveConflict } from "./types/SaveConflict.ts";
import type { SavedCopy } from "./types/SavedCopy.ts";
import type { StateRequest } from "./types/StateRequest.ts";

type Changed = { readonly o: Opened; readonly raw: string };

/**
 * Check, then write: every opened key (the read set) must still hold the copy it was restored from, else
 * `keel.conflict`; each changed key's in-process copy is replaced only after its `ctx.storage.set` resolves. Once every
 * write is stored, each changed store is reported to `observe` as `save` with its head and `from`, the head of the copy
 * it was restored from (0 when none was saved), in save order.
 */
async function commit(
  ctx: Ctx,
  copy: SavedCopy,
  opened: readonly Opened[],
  changed: readonly Changed[],
): Promise<SaveConflict | null> {
  const stale = opened.find((o) => copy.saved.get(o.key) !== o.from);
  if (stale !== undefined) {
    const store = stale.store.id;
    return { code: "keel.conflict", message: `store ${store} changed since this request read it`, data: { store } };
  }
  const wrote = await Promise.allSettled(
    changed.map(async (c) => {
      await ctx.storage.set(c.o.key, c.raw);
      copy.saved.set(c.o.key, savedOf(c.raw));
    }),
  );
  for (const w of wrote) if (w.status === "rejected") throw w.reason;
  for (const c of changed) {
    const was = c.o.from.json;
    const from = typeof was === "object" && was !== null ? Reflect.get(was, "head") : undefined;
    report(ctx, {
      kind: "save",
      store: c.o.store.id,
      head: c.o.store.head(),
      from: typeof from === "number" ? from : 0,
    });
  }
  return null;
}

/**
 * After an action's `ok` (k.server Server state): save every factory store of the request whose snapshot changed to
 * `ctx.storage`, then to the storage's in-process copy (`copyOf`). When another request saved any store this one
 * opened (changed or only read) after this one restored it, nothing is saved and the result is `keel.conflict` (no
 * write skew; the opened stores are the read set). Loads and saves touching a shared key run one at a time in issue
 * order (`inOrder`), so the check and the writes are one step and writes land in order. A rejected `set` rejects the
 * save and leaves that key's copy as it was, so no later save carries the rejected write; a key whose `set` resolved
 * keeps its new copy (copy and storage agree per key; a multi-store save is not atomic across keys). Nothing changed:
 * nothing to check, since the request's reads were one cut (`openStores`).
 */
export async function saveStores(ctx: Ctx, rq: StateRequest): Promise<SaveConflict | null> {
  const opened: Opened[] = [];
  const changed: Changed[] = [];
  for (const h of await Promise.all(rq.held.values()))
    for (const o of h.opened) {
      opened.push(o);
      const raw = JSON.stringify(o.store.snapshot({ meta: true }));
      if (raw !== o.before) changed.push({ o, raw });
    }
  if (changed.length === 0) return null;
  const copy = copyOf(ctx.storage);
  return inOrder(copy.saving, [...new Set(opened.map((o) => o.key))], () => commit(ctx, copy, opened, changed));
}
