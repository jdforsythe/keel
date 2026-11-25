import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { attempt } from "@keel/schema";
import { raise } from "../../unsafe/raise.ts";
import { settleNow } from "../../unsafe/settleNow.ts";
import type { DbStorage } from "../DbStorage.ts";
import { LAYOUT } from "../internal/LAYOUT.ts";
import { checkLayout } from "../internal/checkLayout.ts";
import { checkText } from "../internal/checkText.ts";
import { dbError } from "../internal/dbError.ts";
import { distinctKeys } from "../internal/distinctKeys.ts";
import { opFailed } from "../internal/opFailed.ts";

const SELECT = "select key, value from keel_kv where key in (select value from json_each(?))";
const UPSERT = "insert into keel_kv (key, value) values (?, ?) on conflict (key) do update set value = excluded.value";

/**
 * The SQLite storage driver (std.db) on the `file:` URL `url`, over `node:sqlite`: WAL journal, `synchronous=FULL`,
 * `secure_delete=ON`, `busy_timeout` 5,000 ms. Opening creates or upgrades `keel_kv` and `keel_meta` in one
 * transaction. A newer `layout` rejects E2152; a database that cannot be opened rejects E2153, naming
 * `KEEL_DATABASE_URL` and no part of it. `read` is one statement (one cut); `commit` runs in `BEGIN IMMEDIATE`.
 * Processes on one host may share the file.
 */
export async function sqlite(url: URL): Promise<DbStorage> {
  const opened = attempt(() => new DatabaseSync(fileURLToPath(url)));
  if (!opened.ok)
    return raise(
      dbError(
        "E2153",
        "KEEL_DATABASE_URL: SQLite cannot open the file; check the file: URL and that its folder exists",
      ),
    );
  const db = opened.value;
  const setUp = settleNow(() => {
    db.exec("pragma busy_timeout = 5000");
    db.exec("pragma journal_mode = wal");
    db.exec("pragma synchronous = full");
    db.exec("pragma secure_delete = on");
    tx(db, () => {
      db.exec("create table if not exists keel_kv (key text primary key, value text not null)");
      db.exec("create table if not exists keel_meta (name text primary key, value text not null)");
      const row = db.prepare("select value from keel_meta where name = 'layout'").get();
      if (checkLayout(row?.value))
        db.prepare("insert into keel_meta (name, value) values ('layout', ?)").run(String(LAYOUT));
    });
  });
  if (setUp.threw) {
    db.close();
    const e = setUp.error;
    if (e instanceof Error && "code" in e && (e.code === "E2152" || e.code === "E2153")) return raise(e);
    return raise(dbError("E2153", "KEEL_DATABASE_URL: SQLite cannot open or set up the database"));
  }
  const select = db.prepare(SELECT);
  const upsert = db.prepare(UPSERT);
  const values = (keys: readonly string[]): Map<string, string> => {
    const out = new Map<string, string>();
    for (const r of select.all(JSON.stringify(keys)))
      if (typeof r.key === "string" && typeof r.value === "string") out.set(r.key, r.value);
    return out;
  };
  const run = async <T>(op: string, texts: readonly (string | undefined)[], fn: () => T): Promise<T> => {
    checkText(texts);
    if (!db.isOpen) return raise(new Error(`std.db sqlite: ${op} after close()`));
    const r = settleNow(fn);
    return r.threw ? raise(opFailed("sqlite", op, r.error)) : r.value;
  };
  return {
    get: (key) => run("get", [key], () => values([key]).get(key) ?? null),
    set: (key, value) =>
      run("set", [key, value], () => {
        upsert.run(key, value);
      }),
    read: (keys) =>
      run("read", keys, () => {
        const found = values(keys);
        return keys.map((k) => found.get(k) ?? null);
      }),
    commit: async (writes) => {
      const keys = distinctKeys(writes);
      return run(
        "commit",
        writes.flatMap((w) => [w.key, w.value]),
        () =>
          tx(db, () => {
            const found = values(keys);
            for (const w of writes) if ((found.get(w.key) ?? null) !== w.expect) return false;
            for (const w of writes) if (w.value !== undefined) upsert.run(w.key, w.value);
            return true;
          }),
      );
    },
    close: async () => {
      if (db.isOpen) db.close();
    },
  };
}

/** Runs `fn` in `BEGIN IMMEDIATE`; commits unless it throws or returns `false`. */
function tx<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("begin immediate");
  const s = settleNow(() => {
    const r = fn();
    db.exec(r === false ? "rollback" : "commit");
    return r;
  });
  if (!s.threw) return s.value;
  if (db.isTransaction) db.exec("rollback");
  return raise(s.error);
}
