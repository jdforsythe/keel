import type { Ctx } from "@keel/ctx";
import type { Client, EndpointMap } from "@keel/services";
import { tx } from "@keel/store";
import { asResult } from "../unsafe/asResult.ts";
import type { Outbox } from "./Outbox.type.ts";
import type { OutboxResult } from "./OutboxResult.ts";
import type { SendInput } from "./SendInput.ts";
import { configOf } from "./internal/configOf.ts";
import { flush } from "./internal/flush.ts";
import { persist } from "./internal/persist.ts";

type Output<D extends EndpointMap, K extends keyof D> = Awaited<ReturnType<Client<D>[K]>> extends {
  readonly ok: true;
  readonly value: infer O;
}
  ? O
  : never;

/**
 * Queue a write to `endpoint` at `origin` (std.offline Write) and flush: the entry's `body.write` is
 * `{ key: ctx.random.id('Write'), base }`; the outbox is written to `ctx.storage` `keel.outbox.<id>` first. Resolves
 * `sent`, `queued` (offline, or the network failed), `conflict` or `failed`; a full outbox resolves `failed` with
 * `offline.full` and adds nothing. Throws when `input` is not JSON (a schema-typed input always is).
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
  const key = ctx.random.id("Write");
  const entry: unknown = { key, endpoint, origin, input, base: opts.base, at: ctx.clock.now(), state: "queued" };
  const entries = o.get("entries");
  if (entries.length >= c.limit || new TextEncoder().encode(JSON.stringify([...entries, entry])).length > c.maxBytes) {
    const data = { limit: c.limit, maxBytes: c.maxBytes };
    return { state: "failed", error: { code: "offline.full", message: c.id, data } };
  }
  const added = tx(c.add, entry);
  if (!added.ok) throw new Error(added.error.message);
  await persist(ctx, c);
  return ctx.net.online() ? asResult<Output<D, K>>(await flush(ctx, c, key)) : { state: "queued" };
}
