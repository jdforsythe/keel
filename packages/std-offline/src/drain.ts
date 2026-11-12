import { type Ctx, observe } from "@keel/ctx";
import { owner } from "@keel/reactive";
import { attempt } from "@keel/schema";
import type { EndpointMap } from "@keel/services";
import { tx } from "@keel/store";
import type { Outbox } from "./Outbox.type.ts";
import { OutboxState } from "./internal/OutboxState.ts";
import { configOf } from "./internal/configOf.ts";
import { flush } from "./internal/flush.ts";

/**
 * Inside a scope (E1203 outside one): load the outbox stored in `ctx.storage` (adding each entry the store lacks,
 * `sending` as `queued`), flush, and flush again on each `{ kind: 'net', online: true }` until the scope is disposed.
 */
export async function drain(ctx: Ctx, o: Outbox<EndpointMap>): Promise<void> {
  const sc = owner();
  if (sc === undefined) throw new Error("E1203: drain() outside a scope");
  const c = configOf(o);
  sc.onDispose(observe(ctx, (e) => e.kind === "net" && e.online && void flush(ctx, c)));
  const raw = await ctx.storage.get(`keel.outbox.${c.id}`);
  const json = raw === null ? undefined : attempt((): unknown => JSON.parse(raw));
  const stored = json?.ok ? OutboxState.parse(json.value) : undefined;
  for (const e of stored?.ok ? stored.value.entries : [])
    if (!c.store.get("entries").some((x) => x.key === e.key))
      tx(c.add, { ...e, state: e.state === "sending" ? "queued" : e.state });
  void flush(ctx, c);
}
