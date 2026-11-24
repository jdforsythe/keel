import type { StorageWrite } from "@keel/ctx";
import pg from "pg";
import type { DbStorage } from "../DbStorage.ts";
import { LAYOUT } from "../internal/LAYOUT.ts";
import { checkLayout } from "../internal/checkLayout.ts";
import { checkText } from "../internal/checkText.ts";
import { dbError } from "../internal/dbError.ts";
import { distinctKeys } from "../internal/distinctKeys.ts";
import { opFailed } from "../internal/opFailed.ts";
import type { PgClient } from "./PgClient.ts";
import type { PgPool } from "./PgPool.ts";
import type { PostgresOptions } from "./PostgresOptions.ts";
import { notifyPayloads } from "./notifyPayloads.ts";
import { storageListener } from "./storageListener.ts";
import { verifiedSslmode } from "./verifiedSslmode.ts";

const SELECT = "select key, value from keel_kv where key = any($1::text[])";
const UPSERT =
  "insert into keel_kv (key, value) select * from unnest($1::text[], $2::text[]) on conflict (key) do update set value = excluded.value";
const LOCK =
  "select pg_advisory_xact_lock(hashtextextended(k, 0)) from unnest($1::text[]) with ordinality as t(k, i) order by i";
/** One advisory lock id for opening, so two processes create and upgrade the tables one at a time. */
const OPEN_LOCK = "select pg_advisory_xact_lock(7265657)";

/** Sends each `keel_storage` payload, in order, inside the commit's transaction. */
const NOTIFY = "select pg_notify('keel_storage', p) from unnest($1::text[]) with ordinality as t(p, i) order by i";

const field = (row: unknown, name: string): unknown =>
  typeof row === "object" && row !== null && name in row ? Reflect.get(row, name) : undefined;

/**
 * The Postgres storage driver (std.db) on the `postgres:` or `postgresql:` URL `url`, over a `pg` pool of at most 10
 * connections, TLS as the URL's `sslmode` says. Opening creates or upgrades `keel_kv` and `keel_meta` in one
 * transaction. A newer `layout` rejects E2152; a database that cannot be reached or opened rejects E2153, naming
 * `KEEL_DATABASE_URL` and no part of it. `read` is one `SELECT`; `commit` and `set` are one transaction that takes
 * `pg_advisory_xact_lock` for each key in key order, compares, then writes. Replicas may share the database: `watch` (k.persist Watch) is `LISTEN` on `keel_storage`, announced by `pg_notify` in each store commit's transaction; a pool from `clientFactory` has none.
 */
export async function postgres(url: URL, options: PostgresOptions = {}): Promise<DbStorage> {
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:")
    throw dbError("E2153", "KEEL_DATABASE_URL is not a postgres: or postgresql: URL");
  const pool: PgPool = options.clientFactory?.() ?? quietPool(url);
  let token = "";
  try {
    await inTx(pool, async (c) => {
      await c.query(OPEN_LOCK);
      if (options.clientFactory === undefined) {
        const xid = field((await c.query("select pg_current_xact_id()::text as x")).rows[0], "x");
        token = typeof xid === "string" && /^\d+$/.test(xid) ? xid : "0";
      }
      await c.query("create table if not exists keel_kv (key text primary key, value text not null)");
      await c.query("create table if not exists keel_meta (name text primary key, value text not null)");
      const r = await c.query("select value from keel_meta where name = 'layout'");
      if (checkLayout(field(r.rows[0], "value")))
        await c.query("insert into keel_meta (name, value) values ('layout', $1)", [String(LAYOUT)]);
      return true;
    });
  } catch (e) {
    await pool.end().catch(() => undefined);
    if (e instanceof Error && "code" in e && (e.code === "E2152" || e.code === "E2153")) throw e;
    throw dbError("E2153", "KEEL_DATABASE_URL: the Postgres database cannot be reached or set up");
  }
  let closed = false;
  const live = (op: string): void => {
    if (closed) throw new Error(`std.db postgres: ${op} after close()`);
  };
  const values = async (q: PgPool | PgClient, keys: readonly string[]) => {
    const out = new Map<string, string>();
    for (const row of (await q.query(SELECT, [keys])).rows) {
      const k = field(row, "key");
      const v = field(row, "value");
      if (typeof k === "string" && typeof v === "string") out.set(k, v);
    }
    return out;
  };
  const write = async (writes: readonly StorageWrite[], check: boolean) => {
    const keys = distinctKeys(writes);
    checkText(writes.flatMap((w) => [w.key, w.value]));
    live(check ? "commit" : "set");
    try {
      return await inTx(pool, async (c) => {
        await c.query(LOCK, [keys]);
        if (check) {
          const found = await values(c, keys);
          for (const w of writes) if ((found.get(w.key) ?? null) !== w.expect) return false;
        }
        const stored = writes.filter((w) => w.value !== undefined);
        if (stored.length > 0) await c.query(UPSERT, [stored.map((w) => w.key), stored.map((w) => w.value)]);
        const announced =
          check && token !== ""
            ? stored
                .map((w) => w.key)
                .filter((k) => k.startsWith("keel.store."))
                .sort()
            : [];
        if (announced.length > 0) await c.query(NOTIFY, [notifyPayloads(token, announced)]);
        return true;
      });
    } catch (e) {
      throw opFailed("postgres", check ? "commit" : "set", e);
    }
  };
  const readKeys = async (keys: readonly string[]) => {
    checkText(keys);
    live("read");
    try {
      const found = await values(pool, keys);
      return keys.map((k) => found.get(k) ?? null);
    } catch (e) {
      throw opFailed("postgres", "read", e);
    }
  };
  const listener = options.clientFactory === undefined ? storageListener(url, token) : undefined;
  return {
    ...(listener === undefined ? {} : { watch: listener.watch }),
    get: async (key) => (await readKeys([key]))[0] ?? null,
    set: async (key, value) => {
      await write([{ key, expect: null, value }], false);
    },
    read: readKeys,
    commit: (writes) => write(writes, true),
    close: async () => {
      if (closed) return;
      closed = true;
      await listener?.close();
      await pool.end();
    },
  };
}

/**
 * A `pg` pool of 10 on `url` whose client errors are dropped, idle or checked out: a lost connection fails the query
 * in flight or the next one, which reports it, and never throws from an event the process cannot catch.
 */
function quietPool(url: URL): PgPool {
  const pool = new pg.Pool({ connectionString: verifiedSslmode(url.href), max: 10, connectionTimeoutMillis: 10_000 });
  pool.on("error", () => undefined);
  pool.on("connect", (client) => {
    client.on("error", () => undefined);
  });
  return pool;
}

/** Runs `fn` on one client in a read committed transaction, so each statement after a lock sees what the lock holder committed; `false` rolls back. A failed rollback drops the client. */
async function inTx(pool: PgPool, fn: (c: PgClient) => Promise<boolean>): Promise<boolean> {
  const c = await pool.connect();
  let broken = false;
  try {
    await c.query("begin isolation level read committed");
    const r = await fn(c);
    await c.query(r ? "commit" : "rollback");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {
      broken = true;
    });
    throw e;
  } finally {
    c.release(broken);
  }
}
