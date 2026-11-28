import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import type { StoreReader } from "./StoreReader.ts";
import type { StoreSource } from "./StoreSource.ts";

/** One row of a SQLite file read-only; undefined when the file, the table or the row is absent. */
function sqliteRow(file: string, sql: string, key: string | Uint8Array): string | Uint8Array | undefined {
  if (!existsSync(file)) return undefined;
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const row: unknown = db.prepare(sql).get(key);
    const value = typeof row === "object" && row !== null ? Reflect.get(row, "value") : undefined;
    return typeof value === "string" || value instanceof Uint8Array ? value : undefined;
  } catch {
    return undefined;
  } finally {
    db.close();
  }
}

/**
 * A deployable's storage opened for reading (k.persist), through that storage: `keel_kv` of the SQLite file for
 * `'sqlite'`, Node's localStorage file for `'file'` (UTF-16 keys and values), both reporting no commits, and for
 * `'postgres'` the project's own `@keel/std-db/postgres` driver, whose `watch` reports each commit.
 */
export async function openStore(source: StoreSource): Promise<StoreReader> {
  if (source.kind === "sqlite")
    return {
      get: async (key) => {
        const v = sqliteRow(source.file, "SELECT value FROM keel_kv WHERE key = ?", key);
        return typeof v === "string" ? v : v === undefined ? undefined : Buffer.from(v).toString("utf8");
      },
      close: async () => undefined,
    };
  if (source.kind === "file")
    return {
      get: async (key) => {
        const sql = "SELECT value FROM nodejs_webstorage WHERE key = ?";
        const v = sqliteRow(source.file, sql, Buffer.from(key, "utf16le"));
        return v === undefined ? undefined : Buffer.from(v).toString("utf16le");
      },
      close: async () => undefined,
    };
  const at = createRequire(join(source.project, "package.json")).resolve("@keel/std-db/postgres");
  const mod: unknown = await import(pathToFileURL(at).href);
  const open = typeof mod === "object" && mod !== null ? Reflect.get(mod, "postgres") : undefined;
  if (typeof open !== "function") throw new Error("@keel/std-db/postgres exports no postgres driver");
  const driver: unknown = await open(new URL(source.url));
  const member = (name: string): unknown =>
    typeof driver === "object" && driver !== null ? Reflect.get(driver, name) : undefined;
  const get = member("get");
  const close = member("close");
  const watch = member("watch");
  if (typeof get !== "function" || typeof close !== "function")
    throw new Error("the postgres driver gave no storage with get and close");
  return {
    get: async (key) => {
      const v: unknown = await Reflect.apply(get, driver, [key]);
      return typeof v === "string" ? v : undefined;
    },
    ...(typeof watch === "function" ? { watch: (on: () => void) => Reflect.apply(watch, driver, [() => on()]) } : {}),
    close: () => Reflect.apply(close, driver, []),
  };
}
