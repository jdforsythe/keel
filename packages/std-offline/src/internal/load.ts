import type { Ctx } from "@keel/ctx";
import { attempt, s } from "@keel/schema";
import { OutboxEntry } from "../OutboxEntry.schema.ts";
import type { Config } from "./Config.ts";
import { apply } from "./apply.ts";
import { fault } from "./fault.ts";
import { field } from "./field.ts";
import { flowOf } from "./flowOf.ts";
import { full } from "./full.ts";
import { rewrite } from "./rewrite.ts";
import { storageFailed } from "./storageFailed.ts";

/**
 * Loads the outbox stored in `ctx.storage` once per ctx, entry by entry: adds, in order, each entry the store lacks
 * (`sending` as `queued`), which the ctx then holds, while the entries stay within `limit` and `maxBytes`; the rest are not loaded, nor is an
 * entry that is not an `OutboxEntry`. A stored entry that holds an `origin`, or no string `owner`, loads `failed` with
 * `offline.owner`, owner `""` and no `origin`, and the outbox is then written back once. A value that is not JSON, or
 * whose `entries` is not an array, loads nothing.
 */
export function load(ctx: Ctx, c: Config): Promise<void> {
  const p = c.loads.get(ctx) ?? read(ctx, c);
  c.loads.set(ctx, p);
  return p;
}

async function read(ctx: Ctx, c: Config): Promise<void> {
  const raw = await attempt(() => ctx.storage.get(`keel.outbox.${c.id}`), storageFailed);
  const json = raw.ok && raw.value !== null ? s.json.parseJson(raw.value) : undefined;
  const list = json?.ok ? field(json.value, "entries") : undefined;
  let moved = false;
  for (const x of Array.isArray(list) ? list : []) {
    // The stored entry without its `origin`, which is never read: a value of it marks the entry foreign.
    const { origin, ...rest } = { origin: undefined, ...(typeof x === "object" && x !== null ? x : {}) };
    const foreign = origin !== undefined || typeof field(x, "owner") !== "string";
    const parsed = OutboxEntry.parse(
      foreign ? { ...rest, owner: "", state: "failed", error: fault(c, "offline.owner") } : rest,
    );
    if (!parsed.ok) continue;
    const e = parsed.value;
    const entries = c.store.get("entries");
    // Another ctx's entry has this key: left out here, and kept in this ctx's storage by its writes.
    if (entries.some((y) => y.key === e.key)) {
      flowOf(c, ctx).kept.push(x);
      continue;
    }
    const next = { ...e, state: e.state === "sending" ? ("queued" as const) : e.state };
    if (full(c, [...entries, next])) break;
    apply(c.add, next);
    flowOf(c, ctx).held.add(next.key);
    moved ||= foreign;
  }
  if (moved) await rewrite(ctx, c);
}
