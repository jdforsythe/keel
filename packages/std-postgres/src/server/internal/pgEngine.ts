import pg from "pg";
import type { Isolation } from "../Isolation.ts";
import type { Conn } from "./Conn.ts";
import type { Engine } from "./Engine.ts";
import type { Raw } from "./Raw.ts";
import { TypeCache } from "./TypeCache.ts";

/** Every column arrives as Postgres's text form; `decodeValue` gives the JSON value, as for PGlite. */
const asText = {
  getTypeParser:
    () =>
    (v: string): string =>
      v,
};

type Queryable = { query(config: pg.QueryArrayConfig): Promise<pg.QueryArrayResult> };

const run = async (q: Queryable, text: string, params: readonly (string | null)[]): Promise<Raw> => {
  const r = await q.query({ text, values: [...params], rowMode: "array", types: asText });
  return { fields: r.fields.map((f) => ({ name: f.name, oid: f.dataTypeID })), rows: r.rows, count: r.rowCount ?? 0 };
};

/**
 * The `pg` engine on a `postgres:` or `postgresql:` URL: a pool of at most 10 connections, TLS as the URL's `sslmode`
 * says, idle connections letting the process exit. Client errors are dropped, so a lost connection fails the
 * statement in flight or the next one and never throws from an event.
 */
export function pgEngine(url: string): Engine {
  const pool = new pg.Pool({ connectionString: url, max: 10, allowExitOnIdle: true, connectionTimeoutMillis: 10_000 });
  pool.on("error", () => undefined);
  pool.on("connect", (client) => {
    client.on("error", () => undefined);
  });
  return {
    types: new TypeCache(),
    statement: (text, params) => run(pool, text, params),
    async tx<T>(isolation: Isolation, fn: (c: Conn) => Promise<{ readonly value: T; readonly commit: boolean }>) {
      const client = await pool.connect();
      let broken = false;
      try {
        await client.query(`begin isolation level ${isolation}`);
        const conn: Conn = {
          query: (text, params) => run(client, text, params),
          exec: async (text) => {
            await client.query(text);
          },
        };
        const out = await fn(conn);
        await client.query(out.commit ? "commit" : "rollback");
        return out.value;
      } catch (e) {
        await client.query("rollback").catch(() => {
          broken = true;
        });
        throw e;
      } finally {
        client.release(broken);
      }
    },
  };
}
