import { owner, scope } from "@keel/reactive";
import { s, secretPath } from "@keel/schema";
import { type EndpointMap, service } from "@keel/services";
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
 * Declare an outbox (std.offline) over the k.services `endpoints` map of module `module`'s routes, sent through
 * `service({ module, schema: api })` with an undeclared 400 or 409 read as JSON: the client store `id` with state `{ entries }`,
 * changed only by `<id>.add`, `<id>.settle` and `<id>.resolve`. Inside a scope the store is created now and the outbox
 * stops flushing when that scope is disposed; outside one (a module-level declaration) it is created on first use and
 * lives as long as the module; each ctx that uses it reaches only the entries it added or loaded. `limit` (100) and
 * `maxBytes` (262,144 bytes of encoded entries) bound it. Throws E2652 (an Error with `code`) for an `events: true`
 * endpoint, whose answer is a stream, and E2651 when an endpoint body holds an `s.secret`: entries are stored in the
 * browser.
 */
export function outbox<const D extends EndpointMap>(
  id: string,
  api: D,
  opts: { readonly module: string; readonly limit?: number; readonly maxBytes?: number },
): Outbox<D> {
  for (const [name, e] of Object.entries(api)) {
    if (e.events === true) {
      const message = `E2652 outbox ${id} endpoint ${name} answers a stream`;
      throw Object.assign(new Error(message), { code: "E2652" });
    }
    const at = e.body === undefined ? null : secretPath(e.body);
    if (at !== null) {
      const message = `E2651 outbox ${id} endpoint ${name} body holds s.secret at ${at || "(root)"}`;
      throw Object.assign(new Error(message), { code: "E2651" });
    }
  }
  const schema: EndpointMap = Object.fromEntries(
    Object.entries(api).map(([name, e]) => [name, { ...e, errors: { 400: s.json(), 409: s.json(), ...e.errors } }]),
  );
  const client = service({ module: opts.module, schema });
  let c: Config | undefined;
  const make = (): Config => {
    const st = store(OutboxState, { entries: [] }, { id });
    c = {
      id,
      api,
      client,
      limit: opts.limit ?? 100,
      maxBytes: opts.maxBytes ?? 262_144,
      store: st,
      // An entry is one key in the store: an `add` of a key it has changes nothing.
      add: transaction(st, `${id}.add`, OutboxEntry, (s0, e) =>
        s0.entries.some((x) => x.key === e.key) ? s0 : { entries: [...s0.entries, e] },
      ),
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
      loads: new WeakMap(),
      live: true,
      flows: new WeakMap(),
      writes: new Map(),
    };
    return c;
  };
  const sc = owner();
  sc?.onDispose(() => {
    if (c) c.live = false;
  });
  if (sc) make();
  // Declared outside a scope (module level): the store lives as long as the module, as a module-level `store` does.
  const cfg = (): Config => c ?? scope(() => undefined, { detached: true }).run(make);
  const st = () => cfg().store;
  const o: Outbox<D> = {
    id,
    get schema() {
      return st().schema;
    },
    get payloads() {
      return st().payloads;
    },
    check: (x) => st().check(x),
    get: (k) => st().get(k),
    select: (f) => st().select(f),
    head: () => st().head(),
    log: () => st().log(),
    snapshot: (x) => st().snapshot(x),
    restore: (x) => st().restore(x),
    undo: () => st().undo(),
    undoWhere: (p) => st().undoWhere(p),
    uses: (t) => st().uses(t),
  };
  configOf(o, cfg);
  return o;
}
