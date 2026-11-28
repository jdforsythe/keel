// std.postgres-errors PGlite and `statement_timeout`: PGlite keeps no statement timer, so after every statement the
// engine reads the timeouts in force or kept, puts back any that is not `0` and fails the statement with the defect
// E2461, `data.sqlstate` `0A000`. Judged by value, never by the statement's text; sim runs the same engine.
import { isDefect } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { simEngine } from "../src/server/internal/simEngine.server.ts";

const dataOf = (x: unknown): unknown => (typeof x === "object" && x !== null ? Reflect.get(x, "data") : undefined);

/** What `run` did: `"none"` when it resolved, `"E2461 0A000"` for the refusal, else the value it rejected with. */
const outcomeOf = (run: () => Promise<unknown>): Promise<unknown> =>
  run().then(
    () => "none",
    (thrown: unknown) =>
      isDefect(thrown, "E2461") && Reflect.get(Object(dataOf(thrown)), "sqlstate") === "0A000" ? "E2461 0A000" : thrown,
  );

type Sim = Awaited<ReturnType<typeof simEngine>>;
const shown = async (engine: Sim): Promise<unknown> =>
  (await engine.statement("show statement_timeout", [])).rows[0]?.[0];
const kept = async (engine: Sim): Promise<unknown> =>
  (
    await engine.statement(
      "select count(*)::int from pg_db_role_setting, unnest(setconfig) c where c ilike 'statement_timeout=%'",
      [],
    )
  ).rows[0]?.[0];

test("a session `set statement_timeout` is refused and the setting is back at 0", async () => {
  const engine = await simEngine();
  expect(
    await outcomeOf(() =>
      engine.tx("read committed", async (c) => ({
        value: await c.query("set statement_timeout = 1", []),
        commit: true,
      })),
    ),
  ).toBe("E2461 0A000");
  expect(await shown(engine)).toBe("0");
});

test("a `set local statement_timeout` in a transaction is refused and leaves 0 after it", async () => {
  const engine = await simEngine();
  expect(
    await outcomeOf(() =>
      engine.tx("serializable", async (c) => {
        await c.query("set local statement_timeout = 1", []);
        return { value: await c.query("select 1", []), commit: true };
      }),
    ),
  ).toBe("E2461 0A000");
  expect(await shown(engine)).toBe("0");
});

test("a statement that leaves the timeout at 0 answers as usual, whatever its text names", async () => {
  const engine = await simEngine();
  expect(await outcomeOf(() => engine.statement("set statement_timeout = 0", []))).toBe("none");
  expect(await outcomeOf(() => engine.statement("set statement_timeout = '0s'", []))).toBe("none");
  expect(await outcomeOf(() => engine.statement("select current_setting('statement_timeout')", []))).toBe("none");
  expect(await shown(engine)).toBe("0");
});

test("property: every spelling that leaves a timeout in force is refused alike, and nothing stays kept", async () => {
  const engine = await simEngine();
  const spellings = [
    (n: number) => `set statement_timeout = ${n}`,
    (n: number) => `SET Statement_Timeout TO ${n}`,
    (n: number) => `set U&"statement\\005ftimeout" = ${n}`,
    (n: number) => `select set_config('statement' || '_timeout', '${n}', false)`,
    (n: number) => `alter database postgres set statement_timeout = ${n}`,
    (n: number) => `alter role postgres set statement_timeout = ${n}`,
    (n: number) => `alter role postgres in database postgres set statement_timeout = ${n}`,
  ];
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 100_000 }),
      fc.integer({ min: 0, max: spellings.length - 1 }),
      async (n, i) => {
        const text = spellings[i]?.(n) ?? "";
        expect(await outcomeOf(() => engine.statement(text, [])), text).toBe("E2461 0A000");
        expect(await shown(engine)).toBe("0");
        expect(await kept(engine)).toBe("0");
      },
    ),
    { seed: 1337, numRuns: 20 },
  );
});

test("a function's own `set` clause is refused and the function is not kept", async () => {
  const engine = await simEngine();
  const text = "create function keel_timeout_probe() returns int language sql set statement_timeout = 5 as 'select 1'";
  expect(await outcomeOf(() => engine.statement(text, []))).toBe("E2461 0A000");
  expect(
    (await engine.statement("select count(*)::int from pg_proc where proname = 'keel_timeout_probe'", [])).rows[0]?.[0],
  ).toBe("0");
});
