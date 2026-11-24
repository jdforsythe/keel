import type { PGlite } from "@electric-sql/pglite";
import type { Conn } from "./Conn.ts";
import type { Engine } from "./Engine.ts";
import type { Held } from "./Held.ts";
import type { Level } from "./Level.ts";
import type { Raw } from "./Raw.ts";
import { TypeCache } from "./TypeCache.ts";

type Queryable = Pick<PGlite, "query">;

/**
 * The PGlite engine over `db`, its one session shared: a statement waits while a transaction holds it. Every column
 * arrives as text (the type cache tells PGlite to keep each known type as text), as for `pg`. A call with `held` (sim)
 * waits its turn for the session first, outside `held`, then runs `begin`, each statement and `commit` as separate held
 * calls, so a transaction whose `fn` waits on the clock never holds the session in the drive's eyes.
 */
export async function pgliteEngine(db: PGlite): Promise<Engine> {
  const types = new TypeCache();
  const run = async (q: Queryable, text: string, params: readonly (string | null)[]): Promise<Raw> => {
    const r = await q.query<unknown[]>(text, [...params], { rowMode: "array", parsers: types.parsers });
    return {
      fields: r.fields.map((f) => ({ name: f.name, oid: f.dataTypeID })),
      rows: r.rows,
      count: r.affectedRows ?? 0,
    };
  };
  const top: Conn = {
    query: (text, params) => run(db, text, params),
    exec: async (text) => {
      await db.exec(text);
    },
  };
  await types.load(top);
  let tail: Promise<unknown> = Promise.resolve();
  /** `work` once every earlier exclusive call has finished, whether it answered or threw. */
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const turn = tail.then(work, work);
    tail = turn.catch(() => {});
    return turn;
  };
  const heldTx = <T>(
    level: Level,
    fn: (c: Conn) => Promise<{ readonly value: T; readonly commit: boolean }>,
    held: Held,
  ): Promise<T> =>
    exclusive(async () => {
      await held(() => db.exec(`begin isolation level ${level}`));
      try {
        const out = await fn({
          query: (text, params) => held(() => run(db, text, params)),
          exec: async (text) => {
            await held(() => db.exec(text));
          },
        });
        await held(() => db.exec(out.commit ? "commit" : "rollback"));
        return out.value;
      } catch (e) {
        await held(() => db.exec("rollback")).catch(() => {});
        throw e;
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
