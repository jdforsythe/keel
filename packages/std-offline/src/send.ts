import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
import type { EndpointMap } from "@keel/services";
import { tx } from "@keel/store";
import { asResult } from "../unsafe/asResult.ts";
import type { Outbox } from "./Outbox.type.ts";
import type { OutboxResult } from "./OutboxResult.ts";
import type { SendInput } from "./SendInput.ts";
import type { Output } from "./internal/Output.ts";
import { configOf } from "./internal/configOf.ts";
import { flush } from "./internal/flush.ts";
import { full } from "./internal/full.ts";
import { load } from "./internal/load.ts";
import { persist } from "./internal/persist.ts";

/**
 * Queue a write to `endpoint` at `origin` (std.offline Write) and flush, once the outbox stored in `ctx.storage` has
 * loaded (`drain`): the entry's `body.write` is
 * `{ key: ctx.random.id('Write'), base }`; the outbox is written to `ctx.storage` `keel.outbox.<id>` first. Resolves
 * `sent`, `queued` (offline, or the network failed), `conflict` or `failed`; a full outbox resolves `failed` with
 * `offline.full` and adds nothing; a write to `ctx.storage` that rejects leaves the entry `failed` in memory, posts nothing
 * and resolves `failed` with `offline.storage`. Throws when `input` is not JSON (a schema-typed input always is).
 */
export async function send<const D extends EndpointMap, K extends keyof D & string>(
  ctx: Ctx,
  o: Outbox<D>,
  origin: string,
  endpoint: K,
  input: SendInput<D, K>,
  opts: { readonly base: number },
): Promise<OutboxResult<Output<D, K>>> {
  const c = configOf(o);
  await load(ctx, c);
  const key = ctx.random.id("Write");
  const entry: unknown = { key, endpoint, origin, input, base: opts.base, at: ctx.clock.now(), state: "queued" };
  const entries = o.get("entries");
  if (full(c, [...entries, entry])) {
    const data = { limit: c.limit, maxBytes: c.maxBytes };
    return { state: "failed", error: { code: "offline.full", message: c.id, data } };
  }
  const added = tx(c.add, entry);
  if (!added.ok) throw new Error(added.error.message);
  const stored = await attempt(() => persist(ctx, c));
  if (!stored.ok) {
    const error = { code: "offline.storage" as const, message: stored.error.message, data: {} };
    tx(c.settle, { key, state: "failed", error });
    return { state: "failed", error };
  }
  return ctx.net.online() ? asResult<Output<D, K>>(await flush(ctx, c, key)) : { state: "queued" };
}
