// Child process for migrations.test.ts (not a test file). Run with `node --experimental-strip-types`.
// argv: <database name> <table> <variant>; env `KEEL_POSTGRES_URL`. Variant `a` is the migration `create table T (n int); insert into T values (1)`,
// `b` the same with a trailing comment (a different digest). Prints one JSON line: `{ "ok": true, "rows": <count of T> }` or `{ "ok": false, "error": <text> }`.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { fragment, sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";

const [cap, table, variant] = process.argv.slice(2);
if (cap === undefined || table === undefined) throw new Error("usage: migrate-child <name> <table> <variant>");
const text = `create table ${table} (n int); insert into ${table} values (1)${variant === "b" ? " -- changed" : ""}`;
const db = database(cap, { migrations: { "./migrations/0001-init.sql": text } });
const ctx = createCtx({ mode: "real", seed: 1337 });
const out = await (async () => {
  try {
    const q = sql(s.object({ c: s.number() }))`select count(*)::int as c from ${fragmentOf(table)}`;
    const r = await db(ctx).query(q);
    return r.ok ? { ok: true, rows: r.value[0]?.c } : { ok: false, error: JSON.stringify(r.error) };
  } catch (e) {
    return { ok: false, error: `${Reflect.get(Object(e), "code")} ${String(e)}` };
  }
})();
process.stdout.write(`${JSON.stringify(out)}\n`);
process.exit(0);

function fragmentOf(name: string) {
  return fragment(Object.assign([name], { raw: [name] }));
}
