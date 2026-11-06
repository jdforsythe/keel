import { type Computed, batch, computed, signal } from "@keel/reactive";
import { type Result, type Schema, type SchemaError, err, ok, s } from "@keel/schema";
import type { Bound } from "./internal/Bound.ts";
import type { Row } from "./internal/Row.ts";
import type { TxError } from "./internal/TxError.ts";
import { copy } from "./internal/copy.ts";
import { coreKey } from "./internal/coreKey.ts";
import { freeze } from "./internal/freeze.ts";
import { liveness } from "./internal/liveness.ts";
import { logSchema } from "./internal/logSchema.ts";
import { undeclared } from "./internal/undeclared.ts";
import { violated } from "./internal/violated.ts";
import type { Store } from "./types/Store.ts";
import type { Transaction } from "./types/Transaction.ts";

/**
 * Create a store inside a scope (E1203 outside one). State is validated, copied and deep-frozen.
 * `clock` stamps log entries (default: a per-store counter). Undo replays the log from `initial`.
 */
export function store<T extends object>(
  schema: Schema<T>,
  initial: NoInfer<T>,
  options?: { readonly id?: string; readonly clock?: () => number },
): Store<T> {
  const id = options?.id ?? "store";
  const clock = options?.clock;
  const start = copy(schema, initial);
  if (!start.ok) throw new Error(`store ${id}: initial state invalid: ${start.error.message}`);
  const base = freeze(start.value);
  const root = signal(base);
  const version = signal(0);
  let current = base;
  let rows: Row<T>[] = [];
  let ver = 0;
  let seq = 0;
  let tick = 0;
  const guards: ((state: T) => boolean)[] = [];
  let decls: { alive: () => boolean; allowed: ReadonlySet<Transaction<T, unknown>> }[] = [];
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

  // Union of the live `uses` declarations; none live means nothing is enforced.
  const declared = (t: Transaction<T, unknown>): boolean => {
    decls = decls.filter((d) => d.alive());
    return decls.length === 0 || decls.some((d) => d.allowed.has(t));
  };

  const run = (t: Transaction<T, unknown>, bound: Result<Bound<T>, SchemaError>): Result<T, TxError> => {
    if (!bound.ok) return bound;
    if (!declared(t)) return err(undeclared.make({ transaction: t.name }, `${t.name} is not in this scope's uses`));
    return batch((): Result<T, TxError> => {
      const checked = schema.parse(bound.value.apply(current));
      if (!checked.ok) throw new Error(`transaction ${t.name} returned invalid state: ${checked.error.message}`);
      const next = freeze(checked.value);
      for (const g of guards)
        if (!g(next)) return err(violated.make({ transaction: t.name }, `${t.name} violates an invariant`));
      const at = clock === undefined ? ++tick : clock();
      rows.push({ entry: { id: ++seq, name: t.name, payload: bound.value.payload, at }, apply: bound.value.apply });
      commit(next, rows);
      return ok(next);
    });
  };

  return {
    id,
    get(key) {
      const cell = cells.get(key);
      if (cell === undefined) root.get();
      else cell.get();
      return current[key];
    },
    select: (fn) => computed(() => fn(root.get())),
    log() {
      version.get();
      return rows.map((r) => r.entry);
    },
    snapshot() {
      version.get();
      const state = copy(schema, current);
      const log = copy(
        logSchema(payloads),
        rows.map((r) => r.entry),
      );
      if (!state.ok || !log.ok) throw new Error(`store ${id}: committed state or log no longer fits its schema`);
      return { state: state.value, log: log.value };
    },
    restore(snap) {
      const codec = logSchema(payloads);
      const whole = s.object({ state: schema, log: codec }).parse(snap);
      if (!whole.ok) return whole;
      if (typeof snap !== "object" || snap === null || !("state" in snap) || !("log" in snap))
        throw new Error("unreachable: snapshot passed its schema");
      const state = copy(schema, snap.state);
      if (!state.ok) return state;
      const log = copy(codec, snap.log);
      if (!log.ok) return log;
      const next: Row<T>[] = [];
      for (const e of log.value) {
        const bound = binders.get(e.name)?.(e.payload);
        if (bound === undefined) throw new Error(`unreachable: ${e.name} passed the log schema`);
        if (!bound.ok) return bound;
        next.push({ entry: { ...e, payload: bound.value.payload }, apply: bound.value.apply });
      }
      for (const r of next) {
        seq = Math.max(seq, r.entry.id);
        tick = Math.max(tick, r.entry.at);
      }
      const restored = freeze(state.value);
      commit(restored, next);
      return ok(restored);
    },
    undo() {
      if (rows.length === 0) return false;
      const kept = rows.slice(0, -1);
      commit(
        kept.reduce((st, r) => freeze(r.apply(st)), base),
        kept,
      );
      return true;
    },
    uses(list) {
      decls.push({ alive: liveness(), allowed: new Set(list) });
    },
    [coreKey]: {
      define<P>(name: string, payload: Schema<P>, fn: (state: T, payload: P) => T): Transaction<T, P> {
        if (name === "" || binders.has(name)) throw new Error(`store ${id}: transaction name "${name}" empty or taken`);
        const bind = (raw: unknown): Result<Bound<T>, SchemaError> => {
          const p = copy(payload, raw);
          if (!p.ok) return p;
          const value = freeze(p.value);
          return ok({ payload: value, apply: (st: T) => fn(st, value) });
        };
        payloads.set(name, payload);
        binders.set(name, bind);
        const t: Transaction<T, P> = { name, payload, [coreKey]: (raw) => run(t, bind(raw)) };
        return t;
      },
      guard(check) {
        guards.push(check);
      },
    },
  };
}
