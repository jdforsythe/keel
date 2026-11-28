// Spec: k.serverlog, clause "`server.mjs` of a fixture whose module throws `new Error('user jane@x.com failed')` as it is evaluated, `KEEL_LOG_THROWN` an hour ahead, writes one E1577 record of route `-` ending ` Error: user jane@x.com failed` and exits 1; with the value empty it ends at the fingerprint or the site."
// Seed: 1337 (no generated inputs: fixed process scenarios). Spawns the built `server.mjs` of the leave-process fixture with `LEAVE_MODE=throw`, which makes a module of it throw as it is evaluated; the child is killed in `afterEach`.
// Waits are on the child's output and exit, never on a clock. "An hour ahead" is read from the host clock as the modification time of a file just written (a real process has no sim clock, and a test reads no clock API) and formatted by arithmetic (iso-instant.ts).
// Reading: the record's message is k.leave Process's `uncaught exception in work of route -: ` then the value's form (k.serverlog Thrown values).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { isoOfEpochMs } from "./iso-instant.ts";
import { type Server, buildLeaveFixture, startServer } from "./leave-process-fixture.ts";

const HOUR = 3_600_000;
const nowMs = (): number => {
  const file = path.join(os.tmpdir(), `keel-now-${process.pid}`);
  fs.writeFileSync(file, "");
  const ms = Math.trunc(fs.statSync(file).mtimeMs);
  fs.rmSync(file, { force: true });
  return ms;
};
let fixture = "";
const started: Server[] = [];
beforeAll(() => {
  fixture = buildLeaveFixture();
}, fixedTime(120_000));
afterAll(() => fs.rmSync(fixture, { recursive: true, force: true }));
afterEach(() => {
  for (const server of started.splice(0)) server.stop();
});

async function moduleThrow(window: string) {
  const server = await startServer(fixture, { LEAVE_MODE: "throw", KEEL_LOG_THROWN: window });
  started.push(server);
  const code = await server.exited;
  return { code, records: server.e1577(), text: server.text() };
}

test(
  "`server.mjs` of a fixture whose module throws `new Error('user jane@x.com failed')` as it is evaluated, `KEEL_LOG_THROWN` an hour ahead, writes one E1577 record of route `-` ending ` Error: user jane@x.com failed` and exits 1",
  async () => {
    const { code, records, text } = await moduleThrow(isoOfEpochMs(nowMs() + HOUR));
    expect(records, text).toHaveLength(1);
    expect(records[0]?.message ?? "").toMatch(
      /^uncaught exception in work of route -: Error #[0-9a-f]{8}( at \S+:\d+)? Error: user jane@x\.com failed$/,
    );
    expect(code).toBe(1);
  },
  fixedTime(60_000),
);

test(
  "with `KEEL_LOG_THROWN` empty, the module throw's E1577 record ends at the fingerprint or the site",
  async () => {
    const { records, text } = await moduleThrow("");
    expect(records, text).toHaveLength(1);
    expect(records[0]?.message ?? "").toMatch(
      /^uncaught exception in work of route -: Error #[0-9a-f]{8}( at \S+:\d+)?$/,
    );
    expect(text).not.toContain("jane");
  },
  fixedTime(60_000),
);
