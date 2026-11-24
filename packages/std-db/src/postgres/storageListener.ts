import type { StorageReport } from "@keel/ctx";
import pg from "pg";
import type { StorageListening } from "./StorageListening.ts";
import { verifiedSslmode } from "./verifiedSslmode.ts";

/** The keys of a `keel_storage` payload from another driver, else nothing: its own token's, and anything not shaped `{"o","k"}`, is dropped. */
function foreignKeys(payload: string, own: string): readonly string[] | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const o: unknown = Reflect.get(parsed, "o");
  const k: unknown = Reflect.get(parsed, "k");
  if (String(o) === own || !Array.isArray(k)) return undefined;
  return k.filter((x): x is string => typeof x === "string");
}

/**
 * The listening side of the Postgres driver (std.db): one `pg` client outside the pool, `application_name`
 * `keel-storage-<pid>`, `LISTEN keel_storage`, opened at the first `watch` and ended when the last stops. A notification
 * with `token` is this driver's own commit and is not reported. A lost connection reports `lost` once to each watch, which
 * then reports nothing more; the next `watch` listens again.
 */
export function storageListener(url: URL, token: string): StorageListening {
  const watchers = new Set<(report: StorageReport) => void>();
  let opening: Promise<pg.Client> | undefined;
  let live: pg.Client | undefined;
  const drop = (client: pg.Client, lost: boolean): void => {
    client.removeAllListeners();
    client.on("error", () => undefined);
    if (live === client) {
      live = undefined;
      opening = undefined;
    }
    const gone = [...watchers];
    watchers.clear();
    if (lost) for (const on of gone) on({ kind: "lost" });
    void client.end().catch(() => undefined);
  };
  const open = async (): Promise<pg.Client> => {
    const client = new pg.Client({
      connectionString: verifiedSslmode(url.href),
      application_name: `keel-storage-${process.pid}`,
      connectionTimeoutMillis: 10_000,
    });
    client.on("error", () => drop(client, true));
    client.on("end", () => drop(client, true));
    client.on("notification", (m) => {
      if (m.channel !== "keel_storage" || m.payload === undefined) return;
      const keys = foreignKeys(m.payload, token);
      if (keys === undefined || keys.length === 0) return;
      for (const on of [...watchers])
        try {
          on({ kind: "committed", keys });
        } catch {
          // A watcher's throw never reaches the connection.
        }
    });
    try {
      await client.connect();
      await client.query("listen keel_storage");
    } catch (e) {
      client.removeAllListeners();
      client.on("error", () => undefined);
      await client.end().catch(() => undefined);
      throw e;
    }
    live = client;
    return client;
  };
  const stopIfIdle = async (): Promise<void> => {
    if (watchers.size > 0 || opening === undefined) return;
    const pending = opening;
    opening = undefined;
    live = undefined;
    const client = await pending.catch(() => undefined);
    if (client === undefined) return;
    client.removeAllListeners();
    client.on("error", () => undefined);
    await client.end().catch(() => undefined);
  };
  return {
    watch: async (on) => {
      const mine = on;
      watchers.add(mine);
      opening ??= open();
      const attempt = opening;
      try {
        await attempt;
      } catch (e) {
        watchers.delete(mine);
        if (opening === attempt) opening = undefined;
        throw e;
      }
      return () => {
        if (watchers.delete(mine)) void stopIfIdle();
      };
    },
    close: async () => {
      watchers.clear();
      await stopIfIdle();
    },
  };
}
