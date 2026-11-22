import type { PGlite } from "@electric-sql/pglite";
import type { Conn } from "./Conn.ts";
import type { Engine } from "./Engine.ts";
import type { Level } from "./Level.ts";
import type { Raw } from "./Raw.ts";
import { TypeCache } from "./TypeCache.ts";

type Queryable = Pick<PGlite, "query">;

/**
 * The PGlite engine over `db`, its one session shared: a statement waits while a transaction holds it. Every column
 * arrives as text (the type cache tells PGlite to keep each known type as text), as for `pg`.
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
  return {
    types,
    statement: (text, params) =>
      db.transaction(async (t) => {
        await t.query("set transaction isolation level serializable");
        return run(t, text, params);
      }),
    tx: <T>(level: Level, fn: (c: Conn) => Promise<{ readonly value: T; readonly commit: boolean }>) =>
      db.transaction(async (t) => {
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
