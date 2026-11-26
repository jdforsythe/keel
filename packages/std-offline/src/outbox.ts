import { owner } from "@keel/reactive";
import type { Contract } from "@keel/router/contract";
import { defect, s, secretPath } from "@keel/schema";
import { type Endpoint, service } from "@keel/services";
import { store, transaction } from "@keel/store";
import type { Outbox } from "./Outbox.type.ts";
import { OutboxEntry } from "./OutboxEntry.schema.ts";
import { Resolution } from "./Resolution.schema.ts";
import type { Writes } from "./Writes.ts";
import type { Config } from "./internal/Config.ts";
import { OutboxState } from "./internal/OutboxState.schema.ts";
import { Resolve } from "./internal/Resolve.schema.ts";
import { Settle } from "./internal/Settle.schema.ts";
import { declareConfig } from "./internal/declareConfig.ts";
import { isWrite } from "./internal/isWrite.ts";

/**
 * Declare an outbox (std.offline) over the API write entries of `contract` (k.contract), sent through
 * `service({ contract })` with an undeclared 400 or 409 read as JSON: the client store `id` with state `{ entries }`,
 * changed only by `<id>.add`, `<id>.settle` and `<id>.resolve`. A GET, `events` or page entry is not sent. Inside a
 * scope or at a module's top level the store is created now in that scope, and the outbox stops flushing when the
 * scope is disposed; with no scope (after an `await`) it is E1203. Each ctx that uses it reaches only the
 * entries it added or loaded. `limit` (100) and `maxBytes` (262,144 bytes of encoded entries) bound it.
 * Throws E2651 (an Error with `code`) when a write entry's body holds an `s.secret`: entries are stored in the browser.
 */
export function outbox<const C extends Contract>(
  id: string,
  contract: C,
  opts: { readonly limit?: number | undefined; readonly maxBytes?: number | undefined } = {},
): Outbox<Writes<C>> {
  const api: Record<string, Endpoint> = {};
  for (const [entry, e] of Object.entries(contract.entries)) {
    if (!isWrite(e)) continue;
    const name = entry.slice(contract.module.length + 1);
    const at = e.body === undefined ? null : secretPath(e.body);
    if (at !== null) {
      return defect(`outbox ${id} endpoint ${name} body holds s.secret at ${at || "(root)"}`, "E2651");
    }
    api[name] = e;
  }
  const entries = Object.fromEntries(
    Object.entries(contract.entries).map(([entry, e]) => [
      entry,
      isWrite(e) ? { ...e, errors: { 400: s.json(), 409: s.json(), ...e.errors } } : e,
    ]),
  );
  const client = service({ contract: { ...contract, entries } });
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
  // At a module's top level `owner()` is the compiler's module root; the store is made in it now.
  const at = owner() ?? defect("outbox() outside a scope or a module top level", "E1203");
  at.onDispose(() => {
    if (c) c.live = false;
  });
  const made = at.run(make);
  const cfg = (): Config => made;
  const st = () => cfg().store;
  const o: Outbox<Writes<C>> = {
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
  declareConfig(o, cfg);
  return o;
}
