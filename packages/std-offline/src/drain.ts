import { type Ctx, observe } from "@keel/ctx";
import { owner } from "@keel/reactive";
import { defect } from "@keel/schema";
import type { Outbox } from "./Outbox.type.ts";
import { configOf } from "./internal/configOf.ts";
import { flowOf } from "./internal/flowOf.ts";
import { flush } from "./internal/flush.ts";
import { load } from "./internal/load.ts";
import { own } from "./internal/own.ts";

/**
 * Inside a scope (E1203 outside one): load the outbox stored in `ctx.storage`, once per ctx (adding, in order, each
 * entry the store lacks, `sending` as `queued`, while the entries stay within `limit` and `maxBytes`), make `owner` the
 * ctx's owner (each entry of another owner, or stored with an `origin` or no `owner`, is `failed` with `offline.owner`
 * and never posted), flush that owner's entries, and flush again on each `{ kind: 'net', online: true }` until the scope
 * is disposed, which also drops the retry pending on this ctx. Each ctx reaches only the entries it added or loaded.
 */
export async function drain(ctx: Ctx, o: Outbox<object>, opts: { readonly owner: string }): Promise<void> {
  const sc = owner();
  if (sc === undefined) return defect("drain() outside a scope", { code: "E1203" });
  const c = configOf(o);
  sc.onDispose(observe(ctx, (e) => e.kind === "net" && e.online && void flush(ctx, c)));
  // The scope's end also drops the retry pending on this ctx, and any the post in flight would arm.
  sc.onDispose(() => {
    const f = flowOf(c, ctx);
    f.ended = true;
    f.timer.abort();
  });
  await load(ctx, c);
  await own(ctx, c, opts.owner);
  void flush(ctx, c);
}
