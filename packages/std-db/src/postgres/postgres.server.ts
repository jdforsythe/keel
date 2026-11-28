import type { StorageWrite } from "@keel/ctx";
import { attempt, defect } from "@keel/schema";
import pg from "pg";
import type { DbStorage } from "../DbStorage.ts";
import { DbFailed } from "../internal/DbFailed.schema.ts";
import { LAYOUT } from "../internal/LAYOUT.ts";
import { checkLayout } from "../internal/checkLayout.ts";
import { checkText } from "../internal/checkText.ts";
import { distinctKeys } from "../internal/distinctKeys.ts";
import { driverFault } from "../internal/driverFault.ts";
import { isDriverFailure } from "../internal/isDriverFailure.ts";
import type { PgClient } from "./PgClient.ts";
import type { PgPool } from "./PgPool.ts";
import type { PostgresOptions } from "./PostgresOptions.ts";
import { notifyPayloads } from "./notifyPayloads.server.ts";
import { storageListener } from "./storageListener.server.ts";
import { verifiedSslmode } from "./verifiedSslmode.server.ts";

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
    return defect("KEEL_DATABASE_URL is not a postgres: or postgresql: URL", { code: "E2153" });
  const pool: PgPool = options.clientFactory?.() ?? quietPool(url);
  let token = "";
  let ready = false;
  try {
    const opened = await attempt(
      () =>
        inTx(pool, async (c) => {
          await c.query(OPEN_LOCK);
          if (options.clientFactory === undefined) {
            const xid = field((await c.query("select pg_current_xact_id()::text as x")).rows[0], "x");
            if (typeof xid !== "string" || !/^\d+$/.test(xid))
              return defect("KEEL_DATABASE_URL: the Postgres database cannot be reached or set up", { code: "E2153" });
            token = xid;
          }
          await c.query("create table if not exists keel_kv (key text primary key, value text not null)");
          await c.query("create table if not exists keel_meta (name text primary key, value text not null)");
          const r = await c.query("select value from keel_meta where name = 'layout'");
          if (checkLayout(field(r.rows[0], "value")))
            await c.query("insert into keel_meta (name, value) values ('layout', $1)", [String(LAYOUT)]);
          return true;
        }),
      (x) => {
        return isDriverFailure(x)
          ? DbFailed.make({ driver: "postgres", op: "open", ...driverFault(x) }, "std.db: a storage call failed")
          : undefined;
      },
    );
    if (!opened.ok)
      return defect("KEEL_DATABASE_URL: the Postgres database cannot be reached or set up", {
        code: "E2153",
        cause: opened.error,
      });
    ready = true;
  } finally {
    if (!ready) void (await poolEnded(pool));
  }
  let closed = false;
  const live = (op: string): void => {
    if (closed) defect("std.db postgres: a call after close()", { data: { op } });
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
    const r = await attempt(
      () =>
        inTx(pool, async (c) => {
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
        }),
      (x) => {
        return isDriverFailure(x)
          ? DbFailed.make(
              { driver: "postgres", op: check ? "commit" : "set", ...driverFault(x) },
              "std.db: a storage call failed",
            )
          : undefined;
      },
    );
    return r.ok ? r.value : defect("std.db: a storage call failed", { cause: r.error });
  };
  const readKeys = async (keys: readonly string[]) => {
    checkText(keys);
    live("read");
    const r = await attempt(
      () => values(pool, keys),
      (x) => {
        return isDriverFailure(x)
          ? DbFailed.make({ driver: "postgres", op: "read", ...driverFault(x) }, "std.db: a storage call failed")
          : undefined;
      },
    );
    if (!r.ok) return defect("std.db: a storage call failed", { cause: r.error });
    const found = r.value;
    return keys.map((k) => found.get(k) ?? null);
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
 * Whether `pool` ended. A failed open ends its pool on the way out; a pool that also fails to end (a refused or lost
 * connection, or any other answer of the driver) adds nothing to the failure in flight, which is the one reported.
 */
async function poolEnded(pool: PgPool): Promise<boolean> {
  const ended = await attempt(
    () => pool.end(),
    (x) => {
      return isDriverFailure(x)
        ? DbFailed.make({ driver: "postgres", op: "end", ...driverFault(x) }, "std.db: a storage call failed")
        : undefined;
    },
  );
  return ended.ok;
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
  let done = false;
  try {
    await c.query("begin isolation level read committed");
    const r = await fn(c);
    await c.query(r ? "commit" : "rollback");
    done = true;
    return r;
  } finally {
    if (done) c.release(false);
    else {
      // A rollback that fails, by any answer of the driver, leaves the client broken: it is dropped.
      const rolled = await attempt(
        () => c.query("rollback"),
        (x) => {
          return isDriverFailure(x)
            ? DbFailed.make({ driver: "postgres", op: "rollback", ...driverFault(x) }, "std.db: a storage call failed")
            : undefined;
        },
      );
      c.release(!rolled.ok);
    }
  }
}
