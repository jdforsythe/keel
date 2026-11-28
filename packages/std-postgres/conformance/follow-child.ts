// Child process for follow-cross-process-0192.test.ts (not a test file). Run with `node --experimental-strip-types`.
// argv: <database name> <table>; env `KEEL_POSTGRES_URL`. Process A: in one transaction inserts row 1 into the table and calls `changed(board, { b: 'x' })`; prints one JSON line `{ "ok": true }` or `{ "ok": false, "error": <text> }`.
import { createCtx } from "@keel/ctx";
import { NoRows, fragment, sql } from "@keel/std-postgres";
import { s } from "@keel/schema";
import { database } from "@keel/std-postgres/server";

const [cap, table] = process.argv.slice(2);
if (cap === undefined || table === undefined) throw new Error("usage: follow-child <name> <table>");
const db = database(cap, {
  migrations: { "./migrations/0001-init.sql": `create table ${table} (id int primary key, name text)` },
});
const board = { name: "board.list", params: s.object({ b: s.string() }) };
const T = fragment(Object.assign([table], { raw: [table] }));
const out = await (async () => {
  try {
    const d = db(createCtx({ mode: "real", seed: 1337 }));
    const r = await d.transaction(async (tx) => {
      const w = await tx.run(sql(NoRows)`insert into ${T} (id, name) values (1, 'from a')`);
      if (!w.ok) return w;
      const c: unknown = Reflect.get(tx, "changed");
      if (typeof c !== "function") throw new Error("no changed on tx");
      return await Reflect.apply(c, tx, [board, { b: "x" }]);
    });
    return r.ok ? { ok: true } : { ok: false, error: JSON.stringify(r.error) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
})();
process.stdout.write(`${JSON.stringify(out)}\n`);
process.exit(0);
