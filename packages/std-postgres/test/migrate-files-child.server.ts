// Child process for database.test.ts (not a test file). Run with `node --experimental-strip-types`.
// argv: <database name> <migrations as JSON>; env `KEEL_POSTGRES_URL`. Prints `ok <count of rows in ga>` or the
// thrown error's message and its data as JSON.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";

const [cap, files] = process.argv.slice(2);
if (cap === undefined || files === undefined) throw new Error("usage: migrate-files-child <name> <json>");
const migrations: Record<string, string> = JSON.parse(files);
const db = database(cap, { migrations });
const ctx = createCtx({ mode: "real", seed: 1337 });
const line = await db(ctx)
  .one(sql(s.object({ c: s.number() }))`select count(*)::int as c from ga`)
  .then(
    (r) => (r.ok ? `ok ${r.value.c}` : JSON.stringify(r.error)),
    (e: unknown) => (e instanceof Error ? `${e.message} ${JSON.stringify(Reflect.get(e, "data") ?? null)}` : String(e)),
  );
process.stdout.write(`${line}\n`);
process.exit(0);
