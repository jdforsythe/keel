import type { Clock } from "@keel/ctx";
import { err, ok } from "@keel/schema";
import type { Result } from "@keel/schema";
import { raise } from "../../../unsafe/raise.ts";
import { settle } from "../../../unsafe/settle.ts";
import type { Conflict } from "../../Conflict.ts";
import type { ConstraintError } from "../../ConstraintError.ts";
import { NoRows } from "../../NoRows.schema.ts";
import type { NotFound } from "../../NotFound.ts";
import type { Query } from "../../Query.ts";
import type { ResultError } from "../../ResultError.ts";
import type { StatementError } from "../../StatementError.ts";
import type { Unreachable } from "../../Unreachable.ts";
import { sql } from "../../sql.ts";
import type { ChangedChannel } from "../ChangedChannel.ts";
import type { Database } from "../Database.type.ts";
import type { TransactionOptions } from "../TransactionOptions.ts";
import type { Tx } from "../Tx.ts";
import type { Backend } from "./Backend.ts";
import type { Conn } from "./Conn.ts";
import type { Engine } from "./Engine.ts";
import type { ErrorOf } from "./ErrorOf.ts";
import type { Level } from "./Level.ts";
import type { Raw } from "./Raw.ts";
import type { Step } from "./Step.schema.ts";
import type { ValueOf } from "./ValueOf.ts";
import { changeText } from "./changeText.server.ts";
import { classify } from "./classify.server.ts";
import { errors } from "./errors.server.ts";
import { isSerial } from "./isSerial.server.ts";
import { payloadOf } from "./payloadOf.server.ts";
import { rowsOf } from "./rowsOf.server.ts";
import { toText } from "./toText.server.ts";
import { unexpected } from "./unexpected.server.ts";

/** The level each `allow` runs at. */
const LEVELS: ReadonlyMap<string, Level> = new Map([
  ["write skew", "repeatable read"],
  ["lost updates", "read committed"],
]);
const RUNS = 3;
const NONE: Step = { delay: 0, fault: "none" };

/** The sim plan a database consumes, one step per run of a lone statement and per run of a transaction's `fn`. */
type Plan = { readonly steps: readonly Step[]; readonly clock: Clock };

const paramsOf = (q: Query<unknown>): (string | null)[] => q.params.map(toText);

/** One run of a transaction's `fn`: whether it must run again or lost its connection, and the changes it recorded. */
type RunState = { serial: boolean; lost: boolean; readonly changes: Set<string> };

/** A run's `tx` and, for the database object's own `changed`, the notify of a payload already checked. */
type Run = Tx & { notify(text: string): Promise<Result<null, StatementError>> };

/** The level `opts` asks for: `serializable` without an `allow`; an `allow` it does not take, or no `reason`, throws. */
function levelOf(opts: TransactionOptions | undefined): Level {
  if (opts?.allow === undefined) return "serializable";
  const level = LEVELS.get(opts.allow);
  if (level === undefined) return raise(new Error("std.postgres: transaction allow is not one it takes"));
  if (typeof opts.reason !== "string" || opts.reason.trim() === "")
    return raise(new Error("std.postgres: transaction allow needs a reason"));
  return level;
}

/** Parses each row with `q`'s schema; the first that fails is `postgres.result` with its index, paths and rules. */
function parsed<T>(q: Query<T>, raw: Raw, engine: Engine): Result<T[], ResultError> {
  const out: T[] = [];
  for (const [row, value] of rowsOf(raw, engine.types).entries()) {
    const p = q.schema.parse(value);
    if (!p.ok) {
      const issues = p.error.data.issues.map((i) => ({ path: [...i.path], rule: i.rule }));
      return err({ code: "postgres.result", message: "A row does not fit its schema", data: { row, issues } });
    }
    out.push(p.value);
  }
  return ok(out);
}

/** A row from `run`, whose statement must return none: `postgres.result` naming each column as an unknown key. */
const unwanted = (raw: Raw): ResultError => ({
  code: "postgres.result",
  message: "run's statement returned a row",
  data: {
    row: 0,
    issues:
      raw.fields.length === 0
        ? [{ path: [], rule: "unknown-key" }]
        : raw.fields.map((f) => ({ path: [f.name], rule: "unknown-key" })),
  },
});

/** A driver error as a statement's answer; one that is not expected throws. */
const answer = (e: unknown): StatementError => {
  const c = classify(e);
  if (c === null) return raise(unexpected(e));
  return c;
};

/**
 * The engine, made ready by `backend.ensure()`: a refused or lost connection, opening the store or in the migration
 * pass, is `keel.unreachable`; any other failure throws as it is.
 */
async function ready(backend: Backend): Promise<Engine | Unreachable> {
  const s = await settle(() => backend.ensure());
  if (!s.threw) return s.value;
  if (classify(s.error) === errors.unreachable) return errors.unreachable;
  return raise(s.error);
}

/** Reads `pg_type` again on `c` when `raw` holds a type the cache has not seen (one a migration made). */
async function known(raw: Raw, engine: Engine, c: Conn | null): Promise<void> {
  if (raw.fields.every((f) => engine.types.known.has(f.oid))) return;
  if (c !== null) await engine.types.load(c);
  else
    await engine.tx("read committed", async (t) => {
      await engine.types.load(t);
      return { value: null, commit: false };
    });
}

/**
 * The database of one ctx (std.postgres API) of capability `name` over `backend`. With `plan` (sim) each run of a lone
 * statement and each run of a transaction's `fn` takes the next step (past the end: no delay, no fault); statements on
 * `tx` take none. The changes a committed run recorded go to `backend.changes()` once it has committed.
 */
export function makeDatabase(name: string, backend: Backend, plan?: Plan): Database {
  let taken = 0;
  /** Takes a plan step: waits its delay, then answers its fault, `null` for none. */
  const gate = async (): Promise<Unreachable | Conflict | null> => {
    if (plan === undefined) return null;
    const step = plan.steps[taken] ?? NONE;
    taken += 1;
    if (step.delay > 0) await plan.clock.after(step.delay);
    return step.fault === "unavailable" ? errors.unreachable : step.fault === "conflict" ? errors.conflict : null;
  };

  /**
   * One lone statement, its own `serializable` transaction: on the pool's connection (real), or in a transaction with the
   * prelude (sim). Each run takes a plan step; a serialization failure or deadlock, or a planned `conflict` (which runs
   * the statement and commits nothing), runs it again, at most 3 runs, then is `keel.conflict`.
   */
  const statement = async (q: Query<unknown>): Promise<{ raw: Raw; engine: Engine } | StatementError> => {
    for (let n = 1; ; n++) {
      const stop = await gate();
      if (stop === errors.unreachable) return stop;
      const engine = await ready(backend);
      if (!("tx" in engine)) return engine;
      const forced = stop !== null;
      const s = await settle(async () => {
        const raw =
          backend.pooled && !forced
            ? await engine.statement(q.text, paramsOf(q))
            : await engine.tx("serializable", async (c) => {
                await backend.prelude(c);
                const r = await c.query(q.text, paramsOf(q));
                await known(r, engine, c);
                return { value: r, commit: !forced };
              });
        if (!forced) await known(raw, engine, null);
        return raw;
      });
      if (s.threw) {
        if (!isSerial(s.error)) return answer(s.error);
      } else if (!forced) return { raw: s.value, engine };
      if (n >= RUNS) return errors.conflict;
    }
  };

  const query = async <T>(q: Query<T>): Promise<Result<T[], StatementError>> => {
    const r = await statement(q);
    return "raw" in r ? parsed(q, r.raw, r.engine) : err(r);
  };
  const one = async <T>(q: Query<T>): Promise<Result<T, StatementError | NotFound>> => onlyRow(await query(q));
  const run = async (q: Query<unknown>): Promise<Result<number, StatementError>> => {
    const r = await statement(q);
    if (!("raw" in r)) return err(r);
    return r.raw.rows.length > 0 ? err(unwanted(r.raw)) : ok(r.raw.count);
  };

  /** `fn` at the level `opts` gives (serializable without), rerun on a serialization failure, as the API says. */
  function transaction<R extends Result<unknown, unknown>>(
    fn: (tx: Tx) => Promise<R>,
    opts?: TransactionOptions,
  ): Promise<Result<ValueOf<R>, ErrorOf<R> | ConstraintError | Unreachable | Conflict>>;
  async function transaction(
    fn: (tx: Tx) => Promise<Result<unknown, unknown>>,
    opts?: TransactionOptions,
  ): Promise<Result<unknown, unknown>> {
    return runs(levelOf(opts), fn);
  }

  /** `fn` in transaction runs at `level`, as `transaction` says; the committed run's changes are delivered after. */
  function runs<R extends Result<unknown, unknown>>(
    level: Level,
    fn: (run: Run) => Promise<R>,
  ): Promise<Result<ValueOf<R>, ErrorOf<R> | ConstraintError | Unreachable | Conflict>>;
  async function runs(
    level: Level,
    fn: (run: Run) => Promise<Result<unknown, unknown>>,
  ): Promise<Result<unknown, unknown>> {
    for (let n = 1; ; n++) {
      const stop = await gate();
      if (stop === errors.unreachable) return err(errors.unreachable);
      const engine = await ready(backend);
      if (!("tx" in engine)) return err(engine);
      // A plan step `conflict` lets the run's statements run, then fails it as a serialization failure at its commit.
      const forced = stop !== null;
      const state: RunState = { serial: false, lost: false, changes: new Set() };
      const s = await settle(() =>
        engine.tx(level, async (c) => {
          await backend.prelude(c);
          const r = await fn(txOf(name, c, engine, state));
          return { value: r, commit: r.ok && !forced && !state.serial && !state.lost };
        }),
      );
      const outcome: Result<unknown, unknown> | undefined = s.threw ? undefined : s.value;
      if (s.threw) {
        if (isSerial(s.error)) state.serial = true;
        else {
          const a = answer(s.error);
          if (a === errors.unreachable) state.lost = true;
          else if (a.code === "postgres.constraint") return err(a);
          else return raise(unexpected(s.error));
        }
      }
      if (state.lost) return err(errors.unreachable);
      if ((forced && outcome?.ok === true) || state.serial || outcome === undefined) {
        if (n >= RUNS) return err(errors.conflict);
        continue;
      }
      if (outcome.ok && state.changes.size > 0) backend.changes().committed([...state.changes]);
      return outcome;
    }
  }

  /** A change as its own transaction, its payload checked (E2460) before any step or statement. */
  const changed = async <P>(channel: ChangedChannel<P>, params: P): Promise<Result<null, StatementError>> => {
    const text = changeText(name, channel, params);
    const r = await runs("serializable", (t) => t.notify(text));
    return r.ok ? ok(null) : err(r.error);
  };

  const follow: Database["follow"] = (channel, key, on) =>
    backend.changes().follow(payloadOf(name, channel.name, key), on);

  return { query, one, run, transaction, changed, follow };
}

/** `one`'s answer from `query`'s: the one row, none `keel.notFound`; more than one throws. */
function onlyRow<T>(r: Result<T[], StatementError>): Result<T, StatementError | NotFound> {
  if (!r.ok) return r;
  if (r.value.length > 1) return raise(new Error(`std.postgres: one() got ${r.value.length} rows`));
  for (const row of r.value) return ok(row);
  return err(errors.notFound);
}

/**
 * The statements of one transaction run on `c`. Each runs inside a savepoint, so an expected error (a constraint)
 * leaves the transaction usable; a serialization failure or deadlock marks the run for a rerun, a lost connection ends
 * it, and statements after either answer that error without running.
 */
function txOf(name: string, c: Conn, engine: Engine, state: RunState): Run {
  const stmt = async (q: Query<unknown>): Promise<Raw | StatementError> => {
    if (state.lost) return errors.unreachable;
    if (state.serial) return errors.conflict;
    await c.exec("savepoint keel_statement");
    const s = await settle(async () => {
      const raw = await c.query(q.text, paramsOf(q));
      await c.exec("release savepoint keel_statement");
      await known(raw, engine, c);
      return raw;
    });
    if (!s.threw) return s.value;
    const a = answer(s.error);
    if (a === errors.unreachable) {
      state.lost = true;
      return a;
    }
    await c.exec("rollback to savepoint keel_statement");
    if (a === errors.conflict) state.serial = true;
    return a;
  };
  const query = async <T>(q: Query<T>): Promise<Result<T[], StatementError>> => {
    const r = await stmt(q);
    return "rows" in r ? parsed(q, r, engine) : err(r);
  };
  /** `pg_notify` of a checked payload inside the transaction; recorded for delivery once the run commits. */
  const notify = async (text: string): Promise<Result<null, StatementError>> => {
    const r = await stmt(sql(NoRows)`select pg_notify('keel_changes', ${text})`);
    if (!("rows" in r)) return err(r);
    state.changes.add(text);
    return ok(null);
  };
  return {
    query,
    notify,
    changed: async (channel, params) => notify(changeText(name, channel, params)),
    one: async (q) => onlyRow(await query(q)),
    async run(q) {
      const r = await stmt(q);
      if (!("rows" in r)) return err(r);
      return r.rows.length > 0 ? err(unwanted(r)) : ok(r.count);
    },
  };
}
