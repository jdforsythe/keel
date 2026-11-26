import { AsyncResource } from "node:async_hooks";
import type { PGlite } from "@electric-sql/pglite";
import { attempt } from "@keel/schema";
import type { Conn } from "./Conn.ts";
import type { Engine } from "./Engine.ts";
import type { Held } from "./Held.ts";
import type { Level } from "./Level.ts";
import type { Raw } from "./Raw.ts";
import { TypeCache } from "./TypeCache.server.ts";

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
 * The PGlite engine over `db`, its one session shared: a statement waits while a transaction holds it. Every column
 * arrives as text (the type cache tells PGlite to keep each known type as text), as for `pg`. A call with `held` (sim)
 * waits its turn for the session first, outside `held`, then runs `begin`, each statement and `commit` as separate held
 * calls, so a transaction whose `fn` waits on the clock never holds the session in the drive's eyes.
 */
export async function pgliteEngine(db: PGlite): Promise<Engine> {
  const types = new TypeCache();
  const run = async (q: Queryable, text: string, params: readonly (string | null)[]): Promise<Raw> => {
    const r = await apart(() => q.query<unknown[]>(text, [...params], { rowMode: "array", parsers: types.parsers }));
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
    },
  };
  await types.load(top);
  let tail: Promise<unknown> = Promise.resolve();
  /** `work` once every earlier exclusive call has finished, whether it answered or threw. */
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const turn = tail.then(work, work);
    tail = attempt(() => turn);
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
          },
        });
        await held(() => apart(() => db.exec(out.commit ? "commit" : "rollback")));
        done = true;
        return out.value;
      } finally {
        if (!done) void (await attempt(() => held(() => apart(() => db.exec("rollback")))));
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
              },
            });
            if (!out.commit) await t.rollback();
            return out.value;
          }),
  };
}
