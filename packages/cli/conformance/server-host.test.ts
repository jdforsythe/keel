// Spec: k.deploy, clause "`server.mjs` with `HOST` unset accepts a connection on `127.0.0.1` and on the machine's other addresses; with `HOST=127.0.0.1` it refuses one on the other addresses; with `HOST=nope` it prints one E1560 line naming `HOST` and exits 1."
// Seed: n/a (no generated input). Method: `keel build` over a temp project (boundary-support.ts's `nodeTree`), then `node dist/api/server.mjs` as a child on a free port with `KEEL_SECRET` and the `HOST` each case sets.
// The cases that connect to the machine's other addresses use bind-support.ts's `LAN` (the first non-loopback IPv4 address); on a machine with none the connection halves do not run (stated by the guard below), and the `HOST=nope` half runs everywhere.
// ASSUMED: a `HOST` of `127.0.0.1` leaves the loopback connection accepted; "refuses one on the other addresses" is a failed TCP connection.
import { realpathSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { built, cleanup, materialize, nodeTree } from "./boundary-support.ts";
import { LAN, accepts, exitCode, start, stopAll, up } from "./bind-support.ts";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";

let dir = "";
beforeAll(() => {
  dir = realpathSync(materialize({ ...nodeTree("node") }));
  expect(built(dir).status).toBe(0);
}, fixedTime(600_000));
afterAll(() => cleanup(dir));
afterEach(stopAll);

const server = (host: string | undefined) =>
  start(() => [join(dir, "dist", "api", "server.mjs")], dir, {
    PORT: (port) => String(port),
    KEEL_SECRET: "s".repeat(32),
    ...(host === undefined ? {} : { HOST: host }),
  });

describe("k.deploy HOST", () => {
  it(
    "`server.mjs` with `HOST` unset accepts a connection on `127.0.0.1` and on the machine's other addresses; with `HOST=127.0.0.1` it refuses one on the other addresses; with `HOST=nope` it prints one E1560 line naming `HOST` and exits 1.",
    async () => {
      const open = await server(undefined);
      await up(open);
      expect(await accepts("127.0.0.1", open.port)).toBe(true);
      if (LAN !== undefined) expect(await accepts(LAN, open.port), `connect ${LAN}`).toBe(true);
      const closed = await server("127.0.0.1");
      await up(closed);
      expect(await accepts("127.0.0.1", closed.port)).toBe(true);
      if (LAN !== undefined) expect(await accepts(LAN, closed.port), `connect ${LAN}`).toBe(false);
      const bad = await server("nope");
      expect(await exitCode(bad), bad.out()).toBe(1);
      const e = bad
        .out()
        .split("\n")
        .filter((l) => l.includes("E1560"));
      expect(e).toHaveLength(1);
      expect(e[0]).toContain("HOST");
    },
    fixedTime(600_000),
  );
});
