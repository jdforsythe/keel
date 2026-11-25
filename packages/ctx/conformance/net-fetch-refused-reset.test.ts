// Spec: k.ctx, clause "A real `ctx.net.fetch` to a port nothing listens on, and to a server that resets the connection as it is set up, each rejects with a `TypeError`, with no uncaught exception."
// k.ctx API, "A real `ctx.net.fetch` whose connection is refused or reset rejects with a `TypeError` and never throws outside the returned promise."
// Seed 1337 (the ctx's seed; the requests carry no random input).
// The cases run in a plain `node` child with the test preload (`--import`, through keelConfig) left out: that preload
// (tooling/node-fetch.mjs) wraps each undici socket's `setTypeOfService` to swallow EINVAL, which is the very throw this
// clause rules out, so in-process it would mask the behaviour under test. NODE_OPTIONS is cleared for the child.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, test } from "vitest";

const script = path.join(import.meta.dirname, "fixtures", "refusedAndReset.ts");
const COUNT = 500;

const run = () => {
  const env = { ...process.env, NODE_OPTIONS: undefined };
  const r = spawnSync(process.execPath, [script, String(COUNT)], { encoding: "utf8", timeout: 120_000, env });
  const parsed: unknown = r.status === 0 ? JSON.parse(r.stdout) : null;
  return { r, parsed };
};
const { r, parsed } = run();

describe("a real ctx.net.fetch whose connection is refused or reset", () => {
  test("the child ran to its end with nothing on stderr", () => {
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  });

  test("A real `ctx.net.fetch` whose connection is refused rejects with a `TypeError`, for 500 requests in a row", () => {
    expect(parsed).toMatchObject({ refused: { TypeError: COUNT } });
  });

  test("A real `ctx.net.fetch` whose connection is reset rejects with a `TypeError`, for 500 requests in a row", () => {
    expect(parsed).toMatchObject({ reset: { TypeError: COUNT } });
  });

  test("A real `ctx.net.fetch` whose connection is refused or reset never throws outside the returned promise: no `uncaughtException` or `unhandledRejection`", () => {
    expect(parsed).toMatchObject({ escaped: [] });
  });
});
