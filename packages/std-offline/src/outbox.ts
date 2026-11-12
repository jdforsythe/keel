import { owner } from "@keel/reactive";
import { s } from "@keel/schema";
import { secretPathOf } from "@keel/schema/internal";
import type { EndpointMap } from "@keel/services";
import { store, transaction } from "@keel/store";
import type { Outbox } from "./Outbox.type.ts";
import { OutboxEntry } from "./OutboxEntry.schema.ts";
import { Resolution } from "./Resolution.schema.ts";
import type { Config } from "./internal/Config.ts";
import { OutboxState } from "./internal/OutboxState.ts";
import { configOf } from "./internal/configOf.ts";

/** `<id>.settle`: an entry's next state (`sent` removes it), with a conflict's `head` or the `error`. */
const Settle = s.object({
  key: s.string(),
  state: s.enum(["sent", "queued", "sending", "conflict", "failed"]),
  head: s.int({ min: 0 }).optional(),
  error: s.json().optional(),
});
/** `<id>.resolve`. */
const Resolve = s.object({ key: s.string(), resolution: Resolution });

/**
 * Declare an outbox (std.offline) over a k.services `endpoints` map, inside a scope: the client store `id` with state
 * `{ entries }`, changed only by `<id>.add`, `<id>.settle` and `<id>.resolve`. `limit` (100) and `maxBytes` (262,144
 * bytes of encoded entries) bound it. Throws E2651 (an Error with `code`) when an endpoint body holds an `s.secret`:
 * entries are stored in the browser.
 */
export function outbox<const D extends EndpointMap>(
  id: string,
  api: D,
  opts: { readonly limit?: number; readonly maxBytes?: number } = {},
): Outbox<D> {
  for (const [name, e] of Object.entries(api)) {
    const at = e.body === undefined ? null : secretPathOf(e.body.node);
    if (at !== null) {
      const message = `E2651 outbox ${id} endpoint ${name} body holds s.secret at ${at || "(root)"}`;
      throw Object.assign(new Error(message), { code: "E2651" });
    }
  }
  const st = store(OutboxState, { entries: [] }, { id });
  const c: Config = {
    id,
    api,
    limit: opts.limit ?? 100,
    maxBytes: opts.maxBytes ?? 262_144,
    store: st,
    add: transaction(st, `${id}.add`, OutboxEntry, (s0, e) => ({ entries: [...s0.entries, e] })),
    settle: transaction(st, `${id}.settle`, Settle, (s0, { key, state, ...extra }) =>
      state === "sent"
        ? { entries: s0.entries.filter((e) => e.key !== key) }
        : { entries: s0.entries.map((e) => (e.key === key ? { ...e, state, ...extra } : e)) },
    ),
    resolve: transaction(st, `${id}.resolve`, Resolve, (s0, { key, resolution }) => {
      const entries = s0.entries.filter((e) => e.key !== key);
      const e = s0.entries.find((x) => x.key === key);
      if (resolution === "theirs" || e?.head === undefined) return { entries };
      const { head, error, ...plain } = e;
      return { entries: [...entries, { ...plain, base: head, state: "queued" as const }] };
    }),
    live: true,
    busy: false,
    delay: 1000,
    timer: new AbortController(),
    waits: new Map(),
    again: undefined,
  };
  configOf(st, c);
  owner()?.onDispose(() => {
    c.live = false;
  });
  return st;
}
