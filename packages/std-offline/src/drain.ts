import { type Ctx, observe } from "@keel/ctx";
import { owner } from "@keel/reactive";
import type { EndpointMap } from "@keel/services";
import type { Outbox } from "./Outbox.type.ts";
import { configOf } from "./internal/configOf.ts";
import { flush } from "./internal/flush.ts";
import { load } from "./internal/load.ts";

/**
 * Inside a scope (E1203 outside one): load the outbox stored in `ctx.storage`, once per ctx (adding, in order, each
 * entry the store lacks, `sending` as `queued`, while the entries stay within `limit` and `maxBytes`), flush, and flush again on each `{ kind: 'net', online: true }` until the scope is disposed.
 */
export async function drain(ctx: Ctx, o: Outbox<EndpointMap>): Promise<void> {
  const sc = owner();
  if (sc === undefined) throw new Error("E1203: drain() outside a scope");
  const c = configOf(o);
  sc.onDispose(observe(ctx, (e) => e.kind === "net" && e.online && void flush(ctx, c)));
  await load(ctx, c);
  void flush(ctx, c);
}
