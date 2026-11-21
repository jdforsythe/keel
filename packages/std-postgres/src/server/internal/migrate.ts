import { codeError } from "../../internal/codeError.ts";
import type { Conn } from "./Conn.ts";
import type { Engine } from "./Engine.ts";
import type { Migration } from "./Migration.ts";

/** Advisory lock class for std.postgres (`pg_advisory_xact_lock(class, key)`): key 0 guards `keel_migrations` itself. */
const LOCK_CLASS = 7_265_658;
const TABLE = `create table if not exists keel_migrations (
  capability text not null, id integer not null, name text not null, digest text not null, primary key (capability, id))`;
const APPLIED = "select id::text, name, digest from keel_migrations where capability = $1 order by id";
const RECORD = "insert into keel_migrations (capability, id, name, digest) values ($1, $2, $3, $4)";

/**
 * Applies the pending migrations of capability `name` (std.postgres Migrations), each in its own transaction with its
 * `keel_migrations` row, under an advisory lock per capability, so each runs once across processes. A recorded
 * migration whose file is gone from `files` or whose SHA-256 differs throws E2454. `prelude` runs first in every
 * transaction (a sim schema's `search_path`). Returns whether a migration ran.
 */
export async function migrate(
  engine: Engine,
  name: string,
  files: readonly Migration[],
  prelude: (c: Conn) => Promise<void>,
): Promise<boolean> {
  await engine.tx("read committed", async (c) => {
    await prelude(c);
    await c.query("select pg_advisory_xact_lock($1, 0)", [String(LOCK_CLASS)]);
    await c.exec(TABLE);
    return { value: null, commit: true };
  });
  let ran = false;
  for (;;) {
    const applied = await engine.tx("read committed", async (c) => {
      await prelude(c);
      await c.query("select pg_advisory_xact_lock($1, hashtext($2))", [String(LOCK_CLASS), name]);
      const rows = (await c.query(APPLIED, [name])).rows.map((r) => r.map((v) => String(v)));
      const done = new Set<number>();
      for (const [id, file, digest] of rows) {
        const n = Number(id);
        const now = files[n - 1];
        if (now === undefined)
          throw codeError("E2454", `${name}: the applied migration ${file} is gone from migrations`);
        if (now.digest !== digest)
          throw codeError("E2454", `${name}: the applied migration ${file} changed since it ran (its SHA-256 differs)`);
        done.add(n);
      }
      const next = files.find((f) => !done.has(f.id));
      if (next === undefined) return { value: false, commit: false };
      await c.exec(next.text);
      await c.query(RECORD, [name, String(next.id), next.name, next.digest]);
      return { value: true, commit: true };
    });
    if (!applied) return ran;
    ran = true;
  }
}
