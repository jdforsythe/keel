// Child process for migrations-by-module-0175.test.ts (not a test file). Run with `node --experimental-strip-types` in an app folder.
// argv: <database name> <table>; prints `{ "ok": true, "sum": <sum of column n> }` or `{ "ok": false, "error": <text> }` for the first sim query of `database(name)` (no `migrations`).
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { fragment, sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import { ready } from "@keel/std-postgres/testing";

const [cap, table] = process.argv.slice(2);
if (cap === undefined || table === undefined) throw new Error("usage: app-dir-child <name> <table>");
await ready();
const db: ReturnType<typeof database> = Reflect.apply(database, undefined, [cap]);
const ctx = createCtx({
  mode: "sim",
  seed: 1337,
  schedule: {
    net: [],
    storage: [],
    offline: [],
    plans: { [cap]: Array.from({ length: 20 }, () => ({ delay: 0, fault: "none" as const })) },
  },
});
const name = fragment(Object.assign([table], { raw: [table] }));
const out = await (async () => {
  try {
    const r = await db(ctx).query(sql(s.object({ c: s.number() }))`select sum(n)::int as c from ${name}`);
    return r.ok ? { ok: true, sum: r.value[0]?.c } : { ok: false, error: JSON.stringify(r.error) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
})();
process.stdout.write(`${JSON.stringify(out)}\n`);
process.exit(0);
