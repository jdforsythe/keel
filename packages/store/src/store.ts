import { type Computed, type Scope, batch, computed, owner, signal } from "@keel/reactive";
import { type Result, type Schema, type SchemaError, err, ok, s } from "@keel/schema";
import type { Bound } from "./internal/Bound.ts";
import type { Concurrent } from "./internal/Concurrent.ts";
import { LOG_LIMIT } from "./internal/LOG_LIMIT.ts";
import type { Row } from "./internal/Row.ts";
import type { TxError } from "./internal/TxError.ts";
import { baseSchema } from "./internal/baseSchema.ts";
import { conflict } from "./internal/conflict.ts";
import { copy } from "./internal/copy.ts";
import { coreKey } from "./internal/coreKey.ts";
import { counter } from "./internal/counter.ts";
import { declaredSources } from "./internal/declaredSources.ts";
import { freeze } from "./internal/freeze.ts";
import { holdsSecret } from "./internal/holdsSecret.ts";
import { keySchema } from "./internal/keySchema.ts";
import { logSchema } from "./internal/logSchema.ts";
import { metaSchema } from "./internal/metaSchema.ts";
import { persisted } from "./internal/persisted.ts";
import { registryOf } from "./internal/registryOf.ts";
import { registryPulse } from "./internal/registryPulse.ts";
import { secretGuard } from "./internal/secretGuard.ts";
import { storePayloads } from "./internal/storePayloads.ts";
import { trim } from "./internal/trim.ts";
import { undeclared } from "./internal/undeclared.ts";
import { unpersisted } from "./internal/unpersisted.ts";
import { violated } from "./internal/violated.ts";
import { withoutMeta } from "./internal/withoutMeta.ts";
import type { LogEntry } from "./types/LogEntry.ts";
import type { Store } from "./types/Store.ts";
import type { Transaction } from "./types/Transaction.ts";

/**
 * Create a store inside a scope (E1203 outside one). State is validated, copied and deep-frozen.
 * `clock` stamps log entries (default: a per-store counter). Undo replays the log from the snapshot base
 * (`initial`, or the `initial` of the last restored snapshot); `undoWhere` undoes only a matching latest entry. `id` defaults to `store.<n>`; a live duplicate in the caller's registry
 * (`stores()`, `isolate`) throws; joining and leaving rerun `stores()` readers. `payloads` maps each transaction name to its
 * payload schema (rfc:0070). At most `logLimit` entries (default 256) are kept: a commit or `restore` past it
 * folds the oldest into that base (RFC 0054), so `undo` reaches only kept entries. A payload may hold `s.secret` values;
 * `snapshot()` folds every entry up to the last such one into `initial`, so no secret is written (rfc:0071). A state
 * schema holding `s.secret` throws E1303 at construction. `head()` counts commits and undos that undo; each entry's `id`
 * is the head its commit produced, and a snapshot carries `head`.
 */
export function store<T extends object>(
  schema: Schema<T>,
  initial: NoInfer<T>,
  options?: { readonly id?: string; readonly clock?: () => number; readonly logLimit?: number },
): Store<T> {
  const id = options?.id ?? `store.${++counter.next}`;
  secretGuard(id, schema);
  const registry = registryOf(owner());
  if (registry.has(id)) throw new Error(`store ${id}: id already in use by a live store`);
  const clock = options?.clock;
  const limit = options?.logLimit ?? LOG_LIMIT;
  if (!Number.isInteger(limit) || limit < 0)
    throw new Error(`store ${id}: logLimit ${limit} is not a non-negative integer`);
  const start = copy(schema, initial);
  if (!start.ok) throw new Error(`store ${id}: initial state invalid: ${start.error.message}`);
  let base = freeze(start.value);
  const root = signal(base);
  const version = signal(0);
  let current = base;
  let rows: Row<T>[] = [];
  let ver = 0;
  // The head: commits and undos that undid; each commit's entry id.
  let seq = 0;
  let tick = 0;
  const guards: ((state: T) => boolean)[] = [];
  const decls = new Map<Scope, Set<Transaction<T, unknown>>>();
  const payloads = new Map<string, Schema<unknown>>();
  const binders = new Map<string, (raw: unknown) => Result<Bound<T>, SchemaError>>();

  // One computed per declared top-level key, so get(key) depends on that key only.
  const cells = new Map<PropertyKey, Computed<unknown>>();
  if (schema.node.kind === "object")
    for (const key of Object.keys(schema.node.fields))
      cells.set(
        key,
        computed<unknown>(() => Reflect.get(root.get(), key)),
      );

  const commit = (state: T, next: Row<T>[]): void =>
    batch(() => {
      current = state;
      rows = next;
      root.set(state);
      version.set(++ver);
    });

  // Declarations of the calling scope and its ancestors; none in the chain means unrestricted.
  const declared = (t: Transaction<T, unknown>): boolean => {
    let restricted = false;
    for (let sc = owner(); sc !== undefined; sc = sc.parent) {
      const allowed = decls.get(sc);
      if (allowed === undefined) continue;
      if (allowed.has(t)) return true;
      restricted = true;
    }
    return !restricted;
  };

  // Drop the last entry and replay the rest from the base, raising the head; false when the log is empty.
  const drop = (): boolean => {
    if (rows.length === 0) return false;
    const kept = rows.slice(0, -1);
    seq++;
    commit(
      kept.reduce((st, r) => freeze(r.apply(st)), base),
      kept,
    );
    return true;
  };

  const run = (
    t: Transaction<T, unknown>,
    bound: Result<Bound<T>, SchemaError>,
    options: unknown,
  ): Result<T, TxError> => {
    if (!bound.ok) return bound;
    // An absent option, or one set to undefined, is not given.
    const given = <V>(name: string, codec: Schema<V>): Result<V | undefined, SchemaError> => {
      const raw = typeof options === "object" && options !== null ? Reflect.get(options, name) : undefined;
      return raw === undefined ? ok(undefined) : copy(codec, raw);
    };
    const meta = given("meta", metaSchema);
    if (!meta.ok) return meta;
    const seen = given("base", baseSchema);
    if (!seen.ok) return seen;
    const key = given("key", keySchema);
    if (!key.ok) return key;
    if (!declared(t)) return err(undeclared.make({ transaction: t.name }, `${t.name} is not in this scope's uses`));
    if (key.value !== undefined && rows.some((r) => r.entry.key === key.value)) return ok(current);
    const concurrent = seen.value !== undefined && seen.value !== seq;
    if (concurrent && t.concurrent === "reject")
      return err(
        conflict.make(
          { store: id, transaction: t.name, base: seen.value, head: seq },
          `${t.name}: base ${seen.value} is not head ${seq} of store ${id}`,
        ),
      );
    return batch((): Result<T, TxError> => {
      const checked = schema.parse(bound.value.apply(current));
      if (!checked.ok) throw new Error(`transaction ${t.name} returned invalid state: ${checked.error.message}`);
      const next = freeze(checked.value);
      for (const g of guards)
        if (!g(next)) return err(violated.make({ transaction: t.name }, `${t.name} violates an invariant`));
      const at = clock === undefined ? ++tick : clock();
      const entry: LogEntry = {
        id: ++seq,
        name: t.name,
        payload: bound.value.payload,
        at,
        ...(meta.value === undefined ? {} : { meta: meta.value }),
        ...(concurrent ? { base: seen.value } : {}),
        ...(key.value === undefined ? {} : { key: key.value }),
      };
      rows.push({ entry: freeze(entry), apply: bound.value.apply });
      const kept = trim(base, rows, limit);
      base = kept.base;
      commit(next, kept.rows);
      return ok(next);
    });
  };

  const self: Store<T> = {
    id,
    schema,
    payloads,
    get(key) {
      const cell = cells.get(key);
      if (cell === undefined) root.get();
      else cell.get();
      return current[key];
    },
    select: (fn) => computed(() => fn(root.get())),
    check(state) {
      const parsed = schema.parse(state);
      if (!parsed.ok)
        return err(violated.make({ transaction: "" }, `candidate state rejected: ${parsed.error.message}`));
      for (const g of guards)
        if (!g(parsed.value)) return err(violated.make({ transaction: "" }, "candidate state violates an invariant"));
      return ok(parsed.value);
    },
    head() {
      version.get();
      return seq;
    },
    log() {
      version.get();
      return rows.map((r) => r.entry);
    },
    snapshot(options) {
      version.get();
      // No secret leaves the store: every entry up to the last whose payload holds one folds into `initial` (rfc:0071).
      let cut = 0;
      rows.forEach((r, i) => {
        if (holdsSecret(payloads.get(r.entry.name), r.entry.payload)) cut = i + 1;
      });
      const state = persisted(schema, current);
      const log = persisted(
        logSchema(payloads),
        rows.slice(cut).map((r) => (options?.meta === true ? r.entry : withoutMeta(r.entry))),
      );
      if (!state.ok) throw unpersisted(id, "state", state.error);
      if (!log.ok) throw unpersisted(id, "log", log.error);
      const initial = persisted(
        schema,
        rows.slice(0, cut).reduce((st, r) => freeze(r.apply(st)), base),
      );
      if (!initial.ok) throw unpersisted(id, "initial", initial.error);
      return { state: state.value, log: log.value, initial: initial.value, head: seq };
    },
    restore(snap) {
      const codec = logSchema(payloads);
      // Each entry's shape first, any name and payload: only those two may fold below.
      const entry = s.object({
        id: s.int(),
        name: s.string(),
        at: s.number(),
        meta: metaSchema.optional(),
        base: baseSchema.optional(),
        key: keySchema.optional(),
      });
      const parsed = s.object({ state: schema, log: s.array(entry) }).parse(snap);
      if (!parsed.ok) return parsed;
      // A head below the latest entry's id would let the next commit reuse an id: the snapshot is invalid.
      const latest = parsed.value.log.at(-1)?.id ?? 0;
      const head = s.object({ head: s.int({ min: latest }).optional() }).parse(snap);
      if (!head.ok) return head;
      const state = copy(schema, parsed.value.state);
      if (!state.ok) return state;
      const restored = freeze(state.value);
      // A log this code cannot replay (an undeclared transaction, a refused payload) folds into `state` (k.persist).
      const log = s.object({ log: codec }).parse(snap);
      let next: Row<T>[] | undefined = log.ok ? [] : undefined;
      for (const e of log.ok ? log.value.log : []) {
        const bound = binders.get(e.name)?.(e.payload);
        if (bound === undefined || !bound.ok) next = undefined;
        else next?.push({ entry: freeze({ ...e, payload: bound.value.payload }), apply: bound.value.apply });
      }
      let kept: { base: T; rows: Row<T>[] } = { base: restored, rows: [] };
      if (next !== undefined) {
        const initial = s.object({ initial: schema }).parse(snap);
        const init = initial.ok ? copy(schema, initial.value.initial) : initial;
        if (!init.ok) return init;
        kept = trim(freeze(init.value), next, limit);
      }
      for (const r of next ?? []) tick = Math.max(tick, r.entry.at);
      seq = head.value.head ?? latest;
      base = kept.base;
      commit(restored, kept.rows);
      return ok(restored);
    },
    undo: drop,
    undoWhere(pred) {
      const last = rows.at(-1);
      return last !== undefined && pred(last.entry) && drop();
    },
    uses(list) {
      const sc = owner();
      if (sc === undefined) throw new Error("E1203: uses() called outside any scope; wrap it in scope(fn)");
      const known = decls.get(sc);
      if (known === undefined) {
        decls.set(sc, new Set(list));
        sc.onDispose(() => decls.delete(sc));
      } else for (const x of list) known.add(x);
    },
    [coreKey]: {
      define<P>(
        name: string,
        payload: Schema<P>,
        fn: (state: T, payload: P) => T,
        concurrent: Concurrent,
      ): Transaction<T, P> {
        if (name === "" || binders.has(name)) throw new Error(`store ${id}: transaction name "${name}" empty or taken`);
        if (concurrent !== "reject" && concurrent !== "rebase")
          throw new Error(
            `store ${id}: transaction ${name}: concurrent ${String(concurrent)} is not 'reject' or 'rebase'`,
          );
        const bind = (raw: unknown): Result<Bound<T>, SchemaError> => {
          const p = copy(payload, raw);
          if (!p.ok) return p;
          const value = freeze(p.value);
          return ok({ payload: value, apply: (st: T) => fn(st, value) });
        };
        payloads.set(name, payload);
        binders.set(name, bind);
        const t: Transaction<T, P> = {
          name,
          schema: payload,
          store: self,
          concurrent,
          [coreKey]: (raw, options) => run(t, bind(raw), options),
        };
        declaredSources.set(t, { fn, guards });
        return t;
      },
      guard(check) {
        guards.push(check);
      },
    },
  };
  // signal() above already threw E1203 outside a scope, so an owner exists here.
  registry.set(id, self);
  storePayloads.set(self, payloads);
  owner()?.onDispose(() => {
    if (registry.get(id) !== self) return;
    registry.delete(id);
    registryPulse.fire();
  });
  registryPulse.fire();
  return self;
}
