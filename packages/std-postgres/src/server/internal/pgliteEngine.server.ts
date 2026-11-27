import { AsyncResource } from "node:async_hooks";
import type { PGlite } from "@electric-sql/pglite";
import type { Conn } from "./Conn.ts";
import type { Engine } from "./Engine.ts";
import type { Held } from "./Held.ts";
import type { Level } from "./Level.ts";
import type { Raw } from "./Raw.ts";
import { TypeCache } from "./TypeCache.server.ts";
import { noErrorTakes } from "./noErrorTakes.server.ts";

type Queryable = Pick<PGlite, "query">;

/**
 * The async context each query, each `exec` and each statement of a held transaction runs in inside PGlite (a
 * transaction PGlite opens itself, on a folder, runs in its caller's), made when this module loads. Postgres arms its
 * own wall-clock timers (its statistics flush waits 10 s through `setitimer`, a Node `setTimeout`) in whatever
 * context runs the statement; in this one they are no work of a caller's `simulate` run, whose drive would otherwise
 * wait out each in real time (k.drive Seams: the shared PGlite is made outside the run).
 */
const pglite = new AsyncResource("KEEL_PGLITE");
/** `call` in PGlite's own async context. */
const apart = <T>(call: () => Promise<T>): Promise<T> => pglite.runInAsyncScope(call);

/**
 * Each `statement_timeout` in force or kept, with the statement that puts it back: the session's, each default kept for
 * a database or a role, each function's own setting. One query; names are compared without case, as Postgres does.
 */
const TIMEOUTS = `
select current_setting('statement_timeout') as value, 'set statement_timeout = 0' as fix
union all
select substr(c, strpos(c, '=') + 1),
  case
    when s.setrole = 0 then format('alter database %I reset statement_timeout', d.datname)
    when s.setdatabase = 0 then format('alter role %I reset statement_timeout', r.rolname)
    else format('alter role %I in database %I reset statement_timeout', r.rolname, d.datname)
  end
from pg_db_role_setting s
cross join lateral unnest(s.setconfig) as c
left join pg_database d on d.oid = s.setdatabase
left join pg_roles r on r.oid = s.setrole
where lower(split_part(c, '=', 1)) = 'statement_timeout'
union all
select substr(c, strpos(c, '=') + 1), format('alter function %s reset statement_timeout', p.oid::regprocedure)
from pg_proc p
cross join lateral unnest(p.proconfig) as c
where p.proconfig is not null and lower(split_part(c, '=', 1)) = 'statement_timeout'`;

/** A `statement_timeout` value that keeps no timer: `0` in any unit, quoted or not. */
const ZERO = /^\s*'?\s*0+(?:\.0*)?\s*(?:us|ms|s|min|h|d)?\s*'?\s*$/i;

/**
 * PGlite keeps no statement timer (std.postgres-errors PGlite and `statement_timeout`): each `statement_timeout` in
 * force or kept that is not `0` is put back. Judged by value, never by a statement's text. Whether anything was put
 * back is the answer; after a statement that is the defect E2461 with `data.sqlstate` `0A000`.
 */
async function putBack(q: Queryable): Promise<boolean> {
  const found = await q.query<{ value: string; fix: string }>(TIMEOUTS);
  const fixes = found.rows.filter((r) => !ZERO.test(r.value)).map((r) => r.fix);
  for (const fix of fixes) await q.query(fix);
  return fixes.length > 0;
}

/** After a statement: a `statement_timeout` it left other than `0` is put back, and the statement is E2461 (`0A000`). */
async function refuseTimeout(q: Queryable): Promise<void> {
  if (await putBack(q)) noErrorTakes("0A000");
}

/**
 * The PGlite engine over `db`, its one session shared: a statement waits while a transaction holds it. Every column
 * arrives as text (the type cache tells PGlite to keep each known type as text), as for `pg`. A call with `held` (sim)
 * waits its turn for the session first, outside `held`, then runs `begin`, each statement and `commit` as separate held
 * calls, so a transaction whose `fn` waits on the clock never holds the session in the drive's eyes.
 */
export async function pgliteEngine(db: PGlite): Promise<Engine> {
  const types = new TypeCache();
  const run = async (q: Queryable, text: string, params: readonly (string | null)[]): Promise<Raw> => {
    const r = await apart(() => q.query<unknown[]>(text, [...params], { rowMode: "array", parsers: types.parsers }));
    await apart(() => refuseTimeout(q));
    return {
      fields: r.fields.map((f) => ({ name: f.name, oid: f.dataTypeID })),
      rows: r.rows,
      count: r.affectedRows ?? 0,
    };
  };
  const top: Conn = {
    query: (text, params) => run(db, text, params),
    exec: async (text) => {
      await apart(() => db.exec(text));
      await apart(() => refuseTimeout(db));
    },
  };
  // A timeout a folder kept from an earlier session is put back when the engine opens; no statement ran, so none fails.
  await apart(() => putBack(db));
  await types.load(top);
  let tail: Promise<unknown> = Promise.resolve();
  /** `work` once every earlier exclusive call has finished, whether it answered or threw. */
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    let end = (): void => undefined;
    const next = new Promise<void>((resolve) => {
      end = resolve;
    });
    const turn = tail.then(async () => {
      try {
        return await work();
      } finally {
        end();
      }
    });
    tail = next;
    return turn;
  };
  const heldTx = <T>(
    level: Level,
    fn: (c: Conn) => Promise<{ readonly value: T; readonly commit: boolean }>,
    held: Held,
  ): Promise<T> =>
    exclusive(async () => {
      await held(() => apart(() => db.exec(`begin isolation level ${level}`)));
      let done = false;
      try {
        const out = await fn({
          query: (text, params) => held(() => run(db, text, params)),
          exec: async (text) => {
            await held(() => apart(() => db.exec(text)));
            await held(() => apart(() => refuseTimeout(db)));
          },
        });
        await held(() => apart(() => db.exec(out.commit ? "commit" : "rollback")));
        done = true;
        return out.value;
      } finally {
        if (!done) await held(() => apart(() => db.exec("rollback")));
      }
    });
  return {
    types,
    statement: (text, params, held) =>
      held === undefined
        ? db.transaction(async (t) => {
            await t.query("set transaction isolation level serializable");
            return run(t, text, params);
          })
        : heldTx("serializable", async (c) => ({ value: await c.query(text, params), commit: true }), held),
    tx: <T>(
      level: Level,
      fn: (c: Conn) => Promise<{ readonly value: T; readonly commit: boolean }>,
      held?: Held,
    ): Promise<T> =>
      held !== undefined
        ? heldTx(level, fn, held)
        : db.transaction(async (t) => {
            await t.query(`set transaction isolation level ${level}`);
            const out = await fn({
              query: (text, params) => run(t, text, params),
              exec: async (text) => {
                await t.exec(text);
                await apart(() => refuseTimeout(t));
              },
            });
            if (!out.commit) await t.rollback();
            return out.value;
          }),
  };
}
