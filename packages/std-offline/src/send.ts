import type { Ctx } from "@keel/ctx";
import { defect } from "@keel/schema";
import { tx } from "@keel/store";
import { asResult } from "../unsafe/asResult.ts";
import type { Outbox } from "./Outbox.type.ts";
import type { OutboxResult } from "./OutboxResult.ts";
import type { SendInput } from "./SendInput.ts";
import type { Output } from "./internal/Output.ts";
import { admit } from "./internal/admit.ts";
import { configOf } from "./internal/configOf.ts";
import { fault } from "./internal/fault.ts";
import { flowOf } from "./internal/flowOf.ts";
import { flush } from "./internal/flush.ts";
import { full } from "./internal/full.ts";
import { load } from "./internal/load.ts";
import { own } from "./internal/own.ts";

/**
 * Queue a write to `endpoint` of the outbox's module (std.offline Write) under `owner`, the signed-in user's id or `""`,
 * and flush, once the outbox stored in `ctx.storage` has loaded (`drain`) and `owner` is the ctx's owner (each entry of
 * another owner not `failed` becomes `failed` with `offline.owner`, std.offline Owner): the entry's `body.write` is
 * `{ key: ctx.random.id('Write'), base, owner }`; the outbox is written to `ctx.storage` `keel.outbox.<id>` first, and a running
 * flush does not take the entry until that write settles. Resolves
 * `sent`, `queued` (offline, or the network failed), `conflict` or `failed`; a full outbox resolves `failed` with
 * `offline.full` and adds nothing, as does an owner that stops being the ctx's while the outbox is written for it
 * (`offline.owner`); a write to `ctx.storage` that rejects leaves the entry `failed` in memory, posts nothing
 * and resolves `failed` with `offline.storage` (its message the outbox id). Throws when `input` is not JSON (a schema-typed input always is).
 */
export async function send<const D extends object, K extends keyof D & string>(
  ctx: Ctx,
  o: Outbox<D>,
  endpoint: K,
  input: SendInput<D, K>,
  opts: { readonly base: number; readonly owner: string },
): Promise<OutboxResult<Output<D, K>>> {
  const c = configOf(o);
  await load(ctx, c);
  await own(ctx, c, opts.owner);
  // A `send` or `drain` with another owner ran during that write: this entry would never be posted.
  if (flowOf(c, ctx).owner !== opts.owner) return { state: "failed", error: fault(c, "offline.owner") };
  // A key another ctx's entry has (two ctxs of one seed) is drawn again: an entry is one key in the store.
  let key = ctx.random.id("Write");
  while (o.get("entries").some((e) => e.key === key)) key = ctx.random.id("Write");
  const entry: unknown = {
    key,
    endpoint,
    owner: opts.owner,
    input,
    base: opts.base,
    at: ctx.clock.now(),
    state: "queued",
  };
  const entries = o.get("entries");
  if (full(c, [...entries, entry])) {
    const data = { limit: c.limit, maxBytes: c.maxBytes };
    return { state: "failed", error: { code: "offline.full", message: c.id, data } };
  }
  const added = tx(c.add, entry);
  if (!added.ok) return defect(added.error.message);
  flowOf(c, ctx).held.add(key);
  const error = await admit(ctx, c, key);
  if (error) return { state: "failed", error };
  return ctx.net.online() ? asResult<Output<D, K>>(await flush(ctx, c, key)) : { state: "queued" };
}
