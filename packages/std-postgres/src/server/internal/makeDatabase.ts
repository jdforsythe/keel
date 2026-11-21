import type { Clock } from "@keel/ctx";
import { err, ok } from "@keel/schema";
import type { Result } from "@keel/schema";
import type { Conflict } from "../../Conflict.ts";
import type { NotFound } from "../../NotFound.ts";
import type { Query } from "../../Query.ts";
import type { ResultError } from "../../ResultError.ts";
import type { StatementError } from "../../StatementError.ts";
import type { Unreachable } from "../../Unreachable.ts";
import type { Database } from "../Database.type.ts";
import type { Isolation } from "../Isolation.ts";
import type { Tx } from "../Tx.ts";
import type { Backend } from "./Backend.ts";
import type { Conn } from "./Conn.ts";
import type { Engine } from "./Engine.ts";
import type { Raw } from "./Raw.ts";
import type { Step } from "./Step.ts";
import { classify } from "./classify.ts";
import { errors } from "./errors.ts";
import { isSerial } from "./isSerial.ts";
import { rowsOf } from "./rowsOf.ts";
import { toText } from "./toText.ts";
import { unexpected } from "./unexpected.ts";

const ISOLATIONS: readonly Isolation[] = ["read committed", "repeatable read", "serializable"];
const RUNS = 3;
const NONE: Step = { delay: 0, fault: "none" };

/** The sim plan a database consumes, one step per top-level call and per run of a transaction's `fn`. */
type Plan = { readonly steps: readonly Step[]; readonly clock: Clock };

const paramsOf = (q: Query<unknown>): (string | null)[] => q.params.map(toText);

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
  if (c === null) throw unexpected(e);
  return c;
};

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
 * The database of one ctx (std.postgres API) over `backend`. With `plan` (sim) each top-level call and each run of a
 * transaction's `fn` takes the next step (past the end: no delay, no fault); statements on `tx` take none.
 */
export function makeDatabase(backend: Backend, plan?: Plan): Database {
  let taken = 0;
  /** Takes a plan step: waits its delay, then answers its fault, `null` for none. */
  const gate = async (): Promise<Unreachable | Conflict | null> => {
    if (plan === undefined) return null;
    const step = plan.steps[taken] ?? NONE;
    taken += 1;
    if (step.delay > 0) await plan.clock.after(step.delay);
    return step.fault === "unavailable" ? errors.unreachable : step.fault === "conflict" ? errors.conflict : null;
  };

  /** One top-level statement, outside a transaction (real) or in one with the prelude (sim). */
  const statement = async (q: Query<unknown>): Promise<{ raw: Raw; engine: Engine } | StatementError> => {
    const stop = await gate();
    if (stop !== null) return stop;
    const engine = await backend.ensure();
    try {
      const raw = backend.pooled
        ? await engine.statement(q.text, paramsOf(q))
        : await engine.tx("read committed", async (c) => {
            await backend.prelude(c);
            const r = await c.query(q.text, paramsOf(q));
            await known(r, engine, c);
            return { value: r, commit: true };
          });
      await known(raw, engine, null);
      return { raw, engine };
    } catch (e) {
      return answer(e);
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

  return {
    query,
    one,
    run,
    async transaction(fn, opts) {
      const isolation = opts?.isolation ?? "read committed";
      if (!ISOLATIONS.includes(isolation))
        throw new Error("std.postgres: transaction isolation is not a level it takes");
      for (let n = 1; ; n++) {
        const stop = await gate();
        if (stop === errors.unreachable) return err(errors.unreachable);
        const engine = await backend.ensure();
        // A plan step `conflict` lets the run's statements run, then fails it as a serialization failure at its commit.
        const forced = stop !== null;
        const state = { serial: false, lost: false };
        let outcome: Awaited<ReturnType<typeof fn>> | undefined;
        try {
          outcome = await engine.tx(isolation, async (c) => {
            await backend.prelude(c);
            const r = await fn(txOf(c, engine, state));
            return { value: r, commit: r.ok && !forced && !state.serial && !state.lost };
          });
        } catch (e) {
          if (isSerial(e)) state.serial = true;
          else {
            const a = answer(e);
            if (a === errors.unreachable) state.lost = true;
            else if (a.code === "postgres.constraint") return err(a);
            else throw unexpected(e);
          }
        }
        if (state.lost) return err(errors.unreachable);
        if ((forced && outcome?.ok === true) || state.serial || outcome === undefined) {
          if (n >= RUNS) return err(errors.conflict);
          continue;
        }
        return outcome;
      }
    },
  };
}

/** `one`'s answer from `query`'s: the one row, none `keel.notFound`; more than one throws. */
function onlyRow<T>(r: Result<T[], StatementError>): Result<T, StatementError | NotFound> {
  if (!r.ok) return r;
  if (r.value.length > 1) throw new Error(`std.postgres: one() got ${r.value.length} rows`);
  for (const row of r.value) return ok(row);
  return err(errors.notFound);
}

/**
 * The statements of one transaction run on `c`. Each runs inside a savepoint, so an expected error (a constraint)
 * leaves the transaction usable; a serialization failure or deadlock marks the run for a rerun, a lost connection ends
 * it, and statements after either answer that error without running.
 */
function txOf(c: Conn, engine: Engine, state: { serial: boolean; lost: boolean }): Tx {
  const stmt = async (q: Query<unknown>): Promise<Raw | StatementError> => {
    if (state.lost) return errors.unreachable;
    if (state.serial) return errors.conflict;
    await c.exec("savepoint keel_statement");
    try {
      const raw = await c.query(q.text, paramsOf(q));
      await c.exec("release savepoint keel_statement");
      await known(raw, engine, c);
      return raw;
    } catch (e) {
      const a = answer(e);
      if (a === errors.unreachable) {
        state.lost = true;
        return a;
      }
      await c.exec("rollback to savepoint keel_statement");
      if (a === errors.conflict) state.serial = true;
      return a;
    }
  };
  const query = async <T>(q: Query<T>): Promise<Result<T[], StatementError>> => {
    const r = await stmt(q);
    return "rows" in r ? parsed(q, r, engine) : err(r);
  };
  return {
    query,
    one: async (q) => onlyRow(await query(q)),
    async run(q) {
      const r = await stmt(q);
      if (!("rows" in r)) return err(r);
      return r.rows.length > 0 ? err(unwanted(r)) : ok(r.count);
    },
  };
}
