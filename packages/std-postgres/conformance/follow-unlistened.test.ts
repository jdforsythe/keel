// Spec: std.postgres-changes, clause "On Postgres 17, with `KEEL_POSTGRES_URL` naming a port nothing listens on, `follow` resolves a function, and its `on` gets `{ kind: 'lost' }` exactly once."
// std.postgres-changes, API "When the listening connection does not open, or closes before it listens, `follow` calls `on({ kind: 'lost' })` once and resolves a stop function; it never throws or rejects for the connection."
// Seed: 1337 (the user name and the number of follows are generated; the closed port is whatever the OS just freed).
// Gate: none. The clause says "On Postgres 17", but a port nothing listens on needs no server, so the case runs everywhere; it asserts no more than the clause.
// Assumption: "exactly once" is shown by a later answer of the same database (a lone `query`, `keel.unreachable`) arriving without a second `lost`: no timer is used.
import net from "node:net";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { database } from "@keel/std-postgres/server";
import fc from "fast-check";
import { afterEach, expect, test } from "vitest";
import { SEED, errOf, fresh } from "./fixtures.ts";
import { type Watch, boardChannel, keyOf, until, watch } from "./follow-fixtures.ts";

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const a = srv.address();
      srv.close(() => (typeof a === "object" && a !== null ? resolve(a.port) : reject(new Error("no port"))));
    });
  });

const before = process.env.KEEL_POSTGRES_URL;
afterEach(() => {
  if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
  else process.env.KEEL_POSTGRES_URL = before;
});

test("with `KEEL_POSTGRES_URL` naming a port nothing listens on, `follow` resolves a function, and its `on` gets `{ kind: 'lost' }` exactly once", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z]{3,8}$/), fc.integer({ min: 1, max: 3 }), async (user, follows) => {
      const { cap } = fresh();
      process.env.KEEL_POSTGRES_URL = `postgres://${user}:pw@127.0.0.1:${await freePort()}/db`;
      const d = database(cap, { migrations: { "./migrations/0001-init.sql": "select 1" } })(
        createCtx({ mode: "real", seed: SEED }),
      );
      const watches: Watch[] = [];
      for (let i = 0; i < follows; i++) watches.push(await watch(d, boardChannel, keyOf(`k${i}`)));
      for (const w of watches) expect(typeof w.stop).toBe("function");
      await until(() => watches.every((w) => w.events.length >= 1));
      const r = await d.query(sql(s.object({ c: s.number() }))`select 1::int as c`);
      expect(errOf(r).code).toBe("keel.unreachable");
      for (const w of watches) {
        expect(w.events).toEqual([{ kind: "lost" }]);
        expect(() => w.stop()).not.toThrow();
      }
    }),
    { seed: SEED, numRuns: 3 },
  );
}, 60_000);
