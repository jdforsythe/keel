import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
import { tx } from "@keel/store";
import type { Config } from "./Config.ts";
import { OutboxState } from "./OutboxState.ts";
import { full } from "./full.ts";

/**
 * Loads the outbox stored in `ctx.storage` once per ctx: adds, in order, each entry the store lacks (`sending` as
 * `queued`) while the entries stay within `limit` and `maxBytes`; the rest are not loaded. An unreadable value loads
 * nothing.
 */
export function load(ctx: Ctx, c: Config): Promise<void> {
  const p = c.loads.get(ctx) ?? read(ctx, c);
  c.loads.set(ctx, p);
  return p;
}

async function read(ctx: Ctx, c: Config): Promise<void> {
  const raw = await attempt(() => ctx.storage.get(`keel.outbox.${c.id}`));
  const json = raw.ok && raw.value !== null ? attempt((): unknown => JSON.parse(raw.value ?? "")) : undefined;
  const stored = json?.ok ? OutboxState.parse(json.value) : undefined;
  for (const e of stored?.ok ? stored.value.entries : []) {
    const entries = c.store.get("entries");
    if (entries.some((x) => x.key === e.key)) continue;
    const next = { ...e, state: e.state === "sending" ? ("queued" as const) : e.state };
    if (full(c, [...entries, next])) break;
    tx(c.add, next);
  }
}
