import type { Ctx, StorageWrite } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { copyOf } from "./copyOf.ts";
import { savedOf } from "./savedOf.ts";
import type { Opened } from "./types/Opened.ts";
import type { SaveConflict } from "./types/SaveConflict.ts";
import type { StateRequest } from "./types/StateRequest.ts";

/**
 * After an action's `ok` (k.persist Server saves): one `ctx.storage.commit` of every opened key, each changed store's
 * `snapshot({ meta: true })` JSON with `expect` the value it was restored from, and each unchanged key as a condition
 * (the read set). `false` is `keel.conflict` with nothing saved, and the copy (`copyOf`) drops the keys it named; `true`
 * takes the new values into the copy and reports each changed store to `observe` as `save` with its head and `from`,
 * the head of the snapshot it was restored from (0 when none was saved). Nothing changed: no commit, `null`.
 */
export async function saveStores(ctx: Ctx, rq: StateRequest): Promise<SaveConflict | null> {
  const byKey = new Map<string, { readonly o: Opened; readonly raw: string | undefined }>();
  for (const h of await Promise.all(rq.held.values()))
    for (const o of h.opened) {
      const raw = JSON.stringify(o.store.snapshot({ meta: true }));
      byKey.set(o.key, { o, raw: raw === o.before ? undefined : raw });
    }
  const all = [...byKey.values()];
  const changed = all.filter((c) => c.raw !== undefined);
  if (changed.length === 0) return null;
  const copy = copyOf(ctx.storage);
  const writes: StorageWrite[] = all.map(({ o, raw }) =>
    raw === undefined ? { key: o.key, expect: o.from.raw } : { key: o.key, expect: o.from.raw, value: raw },
  );
  if (!(await ctx.storage.commit(writes))) {
    for (const w of writes) copy.saved.delete(w.key);
    const store = changed[0]?.o.store.id ?? "";
    return { code: "keel.conflict", message: `store ${store} changed since this request read it`, data: { store } };
  }
  for (const { o, raw } of changed) {
    copy.saved.set(o.key, savedOf(raw ?? null));
    const was = o.from.json;
    const from = typeof was === "object" && was !== null ? Reflect.get(was, "head") : undefined;
    report(ctx, { kind: "save", store: o.store.id, head: o.store.head(), from: typeof from === "number" ? from : 0 });
  }
  return null;
}
