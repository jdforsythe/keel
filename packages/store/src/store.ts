import { type Computed, type Scope, batch, computed, owner, signal } from "@keel/reactive";
import { type Result, type Schema, type SchemaError, err, ok, piiPaths, piiValues, s } from "@keel/schema";
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
import { givenPiiOf } from "./internal/givenPiiOf.ts";
import { holdsSecret } from "./internal/holdsSecret.ts";
import { keySchema } from "./internal/keySchema.ts";
import { keyWindow } from "./internal/keyWindow.ts";
import { logSchema } from "./internal/logSchema.ts";
import { metaSchema } from "./internal/metaSchema.ts";
import { moduleWrites } from "./internal/moduleWrites.ts";
import { persisted } from "./internal/persisted.ts";
import { registries } from "./internal/registries.ts";
import { registryOf } from "./internal/registryOf.ts";
import { registryPulse } from "./internal/registryPulse.ts";
import { secretGuard } from "./internal/secretGuard.ts";
import { statePiiOf } from "./internal/statePiiOf.ts";
import { storePayloads } from "./internal/storePayloads.ts";
import { storeReads } from "./internal/storeReads.ts";
import { trim } from "./internal/trim.ts";
import { undeclared } from "./internal/undeclared.ts";
import { unpersisted } from "./internal/unpersisted.ts";
import { violated } from "./internal/violated.ts";
import { waitingSnapshot } from "./internal/waitingSnapshot.ts";
import { withoutMeta } from "./internal/withoutMeta.ts";
import { snapshotKeys } from "./snapshotKeys.ts";
import type { LogEntry } from "./types/LogEntry.ts";
import type { Snapshot } from "./types/Snapshot.ts";
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
 * is the head its commit produced, and a snapshot carries `head`. `keys` holds the `{ name, key }` of the latest
 * `keyLimit` commits made with a `key` (default 1024, a positive integer); a write whose transaction and `key` it holds
 * commits nothing (k.sync). A store created while `resume` holds a `#k-state` snapshot for its id starts from it.
 */
export function store<T extends object>(
  schema: Schema<T>,
  initial: NoInfer<T>,
  options?: {
    readonly id?: string;
    readonly clock?: () => number;
    readonly logLimit?: number;
    readonly keyLimit?: number;
  },
): Store<T> {
  const id = options?.id ?? `store.${++counter.next}`;
  secretGuard(id, schema);
  const registry = registryOf(owner());
  if (registry.has(id)) throw new Error(`store ${id}: id already in use by a live store`);
  const clock = options?.clock;
  const limit = options?.logLimit ?? LOG_LIMIT;
  if (!Number.isInteger(limit) || limit < 0)
    throw new Error(`store ${id}: logLimit ${limit} is not a non-negative integer`);
  const keyLimit = options?.keyLimit ?? 1024;
  if (!Number.isInteger(keyLimit) || keyLimit < 1)
    throw new Error(`store ${id}: keyLimit ${keyLimit} is not a positive integer`);
  const start = copy(schema, initial);
  // `givenPii(store)`: the marked values of the state as last given, before a codec copy drops undeclared keys.
  const stateMarked = piiPaths(schema).length > 0;
  let statePii: readonly string[] = stateMarked && start.ok ? piiValues(schema, initial) : [];
  // The same of the base `undo` replays from, so an undo to it gives its values back.
  let basePii = statePii;
  const piiOf = (v: unknown): readonly string[] => (stateMarked ? piiValues(schema, v) : []);
  /** `basePii` after `trim` folded the oldest of `before` into the base, leaving `after`. */
  const folded = (before: readonly Row<T>[], after: readonly Row<T>[]): void => {
    const n = before.length - after.length;
    if (n > 0) basePii = before[n - 1]?.pii ?? basePii;
  };
  if (!start.ok) throw new Error(`store ${id}: initial state invalid: ${start.error.message}`);
  let base = freeze(start.value);
  let root = signal(base);
  let version = signal(0);
  // While the store is made, a restore (a `#k-state` snapshot waiting for its id) gives it new signals holding that
  // state: nothing is written, so a store made inside an effect's run (a `For` row) starts from it too.
  let making = true;
  let current = base;
  let rows: Row<T>[] = [];
  // The `{ name, key }` of the latest `keyLimit` commits made with a `key`, oldest first (k.sync Write key).
  const keys = keyWindow(keyLimit);
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

  const commit = (state: T, next: Row<T>[]): void => {
    if (making) {
      current = state;
      rows = next;
      root = signal(state);
      version = signal(++ver);
      return;
    }
    batch(() => {
      current = state;
      rows = next;
      root.set(state);
      version.set(++ver);
    });
  };

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

  // A store in the module registry is process-wide: the installed check may refuse any change to it (k.resume Stores,
  // k.server), before anything is validated or written.
  const writable = (): void => {
    if (registry === registries.shared) moduleWrites.check?.(id);
  };

  // Creating and reading a store notes it to the read tap, if one is set (k.leave Snapshots).
  const read = (): void => storeReads.note?.(id);

  // Drop the last entry and replay the rest from the base, raising the head; false when the log is empty.
  const drop = (): boolean => {
    if (rows.length === 0) return false;
    const kept = rows.slice(0, -1);
    seq++;
    // The state undo returns to is the one the entry before made: its values as given then.
    statePii = kept.at(-1)?.pii ?? basePii;
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
    writable();
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
    const held = key.value;
    if (held !== undefined && keys.has({ name: t.name, key: held })) return ok(current);
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
      const frozen = freeze(entry);
      if (bound.value.given !== undefined) givenPiiOf.set(frozen, bound.value.given);
      const pii = piiOf(next);
      rows.push({ entry: frozen, apply: bound.value.apply, ...(stateMarked ? { pii } : {}) });
      const kept = trim(base, rows, limit);
      folded(rows, kept.rows);
      base = kept.base;
      statePii = pii;
      if (key.value !== undefined) keys.add({ name: t.name, key: key.value });
      commit(next, kept.rows);
      return ok(next);
    });
  };

  const self: Store<T> = {
    id,
    schema,
    payloads,
    get(key) {
      read();
      const cell = cells.get(key);
      if (cell === undefined) root.get();
      else cell.get();
      return current[key];
    },
    select: (fn) => {
      read();
      return computed(() => fn(root.get()));
    },
    check(state) {
      const parsed = schema.parse(state);
      if (!parsed.ok)
        return err(violated.make({ transaction: "" }, `candidate state rejected: ${parsed.error.message}`));
      for (const g of guards)
        if (!g(parsed.value)) return err(violated.make({ transaction: "" }, "candidate state violates an invariant"));
      return ok(parsed.value);
    },
    head() {
      read();
      version.get();
      return seq;
    },
    log() {
      read();
      version.get();
      return rows.map((r) => r.entry);
    },
    snapshot(options) {
      read();
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
      return {
        state: state.value,
        log: log.value,
        initial: initial.value,
        head: seq,
        keys: keys.list(),
      };
    },
    restore(snap) {
      // Starting from a waiting `#k-state` snapshot while the store is made is not a write.
      if (!making) writable();
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
      const last = parsed.value.log.at(-1)?.id ?? 0;
      const head = s.object({ head: s.int({ min: last }).optional() }).parse(snap);
      if (!head.ok) return head;
      // Without `keys`, the log entries' keys, taken before any fold.
      const pairs = s.object({ keys: s.array(s.object({ name: s.string(), key: keySchema })).optional() }).parse(snap);
      if (!pairs.ok) return pairs;
      const restoredKeys = snapshotKeys({ keys: pairs.value.keys, log: parsed.value.log });
      const state = copy(schema, parsed.value.state);
      if (!state.ok) return state;
      const restored = freeze(state.value);
      // Every state the snapshot gives (its state and its `initial`): an undo may return to the base, and the snapshot's
      // own entries are not judged one by one.
      const initialGiven = s.object({ initial: schema }).parse(snap);
      const given = stateMarked
        ? [...new Set([...piiOf(parsed.value.state), ...(initialGiven.ok ? piiOf(initialGiven.value.initial) : [])])]
        : [];
      // A log this code cannot replay (an undeclared transaction, a refused payload) folds into `state` (k.persist).
      const log = s.object({ log: codec }).parse(snap);
      let next: Row<T>[] | undefined = log.ok ? [] : undefined;
      for (const e of log.ok ? log.value.log : []) {
        const bound = binders.get(e.name)?.(e.payload);
        if (bound === undefined || !bound.ok) next = undefined;
        else
          next?.push({
            entry: freeze({ ...e, payload: bound.value.payload }),
            apply: bound.value.apply,
            ...(stateMarked ? { pii: given } : {}),
          });
      }
      let kept: { base: T; rows: Row<T>[] } = { base: restored, rows: [] };
      if (next !== undefined) {
        const initial = s.object({ initial: schema }).parse(snap);
        const init = initial.ok ? copy(schema, initial.value.initial) : initial;
        if (!init.ok) return init;
        kept = trim(freeze(init.value), next, limit);
      }
      for (const r of next ?? []) tick = Math.max(tick, r.entry.at);
      seq = head.value.head ?? last;
      base = kept.base;
      keys.reset(restoredKeys);
      basePii = given;
      statePii = given;
      commit(restored, kept.rows);
      return ok(restored);
    },
    undo() {
      writable();
      return drop();
    },
    undoWhere(pred) {
      writable();
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
        const marked = piiPaths(payload).length > 0;
        const bind = (raw: unknown): Result<Bound<T>, SchemaError> => {
          const p = copy(payload, raw);
          if (!p.ok) return p;
          const value = freeze(p.value);
          return ok({
            payload: value,
            apply: (st: T) => fn(st, value),
            ...(marked ? { given: piiValues(payload, raw) } : {}),
          });
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
  statePiiOf.set(self, () => statePii);
  storePayloads.set(self, payloads);
  owner()?.onDispose(() => {
    if (registry.get(id) !== self) return;
    registry.delete(id);
    registryPulse.fire();
  });
  // Created while islands resume, it starts from the `#k-state` snapshot waiting for its id (k.resume Stores). One its
  // schema refuses is marked so `resume` warns E1253 for it, and the store starts from `initial`.
  const waiting = waitingSnapshot(id);
  if (waiting !== undefined) {
    if (self.restore(waiting.snapshot).ok) waiting.take();
    else waiting.refuse();
  }
  making = false;
  read();
  registryPulse.fire();
  return self;
}
