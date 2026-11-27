// std.postgres Modes: PGlite keeps no statement timer, so a `pglite:` engine refuses a statement that leaves
// `statement_timeout` other than `0`: it sets it back to `0` and fails with SQLSTATE `0A000`.
import { attempt } from "@keel/schema";
import { expect, test } from "vitest";
import { simEngine } from "../src/server/internal/simEngine.server.ts";

const codeOf = (x: unknown): unknown => (typeof x === "object" && x !== null ? Reflect.get(x, "code") : undefined);

/** What `run` rejected with: its SQLSTATE, or `"none"` when it resolved. */
async function sqlstateOf(run: () => Promise<unknown>): Promise<unknown> {
  const r = await attempt(run, (thrown) => ({ code: "probe", message: "probe", data: codeOf(thrown) }));
  return r.ok ? "none" : r.error.data;
}

const shown = async (engine: Awaited<ReturnType<typeof simEngine>>): Promise<unknown> =>
  (await engine.statement("show statement_timeout", [])).rows[0]?.[0];

test("a session `set statement_timeout` is refused with 0A000 and the setting is back at 0", async () => {
  const engine = await simEngine();
  expect(
    await sqlstateOf(() =>
      engine.tx("read committed", async (c) => ({
        value: await c.query("set statement_timeout = 1", []),
        commit: true,
      })),
    ),
  ).toBe("0A000");
  expect(await shown(engine)).toBe("0");
});

test("a `set local statement_timeout` in a transaction is refused with 0A000 and leaves 0 after it", async () => {
  const engine = await simEngine();
  expect(
    await sqlstateOf(() =>
      engine.tx("serializable", async (c) => {
        await c.query("set local statement_timeout = 1", []);
        return { value: await c.query("select 1", []), commit: true };
      }),
    ),
  ).toBe("0A000");
  expect(await shown(engine)).toBe("0");
});

test("a statement naming `statement_timeout` that leaves it at 0 answers as usual", async () => {
  const engine = await simEngine();
  expect(await sqlstateOf(() => engine.statement("set statement_timeout = 0", []))).toBe("none");
  expect(await sqlstateOf(() => engine.statement("select current_setting('statement_timeout')", []))).toBe("none");
  expect(await shown(engine)).toBe("0");
});
