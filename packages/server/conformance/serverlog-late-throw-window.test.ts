// Spec: k.serverlog, clause "With `KEEL_LOG_THROWN` an instant one hour after start, in production mode, `server.mjs` of the `/late` fixture writes one E1577 record whose message matches `^uncaught exception in work of route \S+: Error #[0-9a-f]{8}( at \S+:\d+)? Error: user jane@x\.com failed$`; where `jane@x.com` is a `.pii()` value of that request's input it ends `Error: user [pii] failed`; after that instant the record ends at the fingerprint or the site."
// Seed: 1337 (no generated inputs: fixed process scenarios). Spawns the built `server.mjs` of the leave-process fixture in json format on a port the OS just freed; the child is killed in `afterEach`.
// Waits are on the child's output and exit, never on a clock. The instants are read from the host clock as the modification time of a file just written (a real process has no sim clock, and a test reads no clock API) and formatted by arithmetic (iso-instant.ts).
// Assumption: "after that instant" is an instant already past at start (one hour before it); the spec writes no limit for a past instant.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { isoOfEpochMs } from "./iso-instant.ts";
import { type Server, buildLeaveFixture, listening, startServer, statusOf } from "./leave-process-fixture.ts";

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

async function lateRecord(path: string, window: string, email?: string) {
  const server = await startServer(fixture, { LEAVE_THROW: "error", KEEL_LOG_THROWN: window });
  started.push(server);
  expect(await listening(server), server.text()).toBe(true);
  if (email === undefined) expect(await statusOf(server.port, path)).toBe(200);
  else {
    const res = await fetch(`http://127.0.0.1:${server.port}${path}`, {
      method: "POST",
      body: JSON.stringify({ email }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-keel": "1",
        origin: `http://127.0.0.1:${server.port}`,
      },
    });
    expect(res.status, server.text()).toBe(200);
  }
  expect(await server.until(() => server.e1577().length > 0)).toBe(true);
  await server.exited;
  return { records: server.e1577(), text: server.text() };
}

test(
  "with `KEEL_LOG_THROWN` an instant one hour after start, in production mode, `server.mjs` of the `/late` fixture writes one E1577 record whose message matches `^uncaught exception in work of route \\S+: Error #[0-9a-f]{8}( at \\S+:\\d+)? Error: user jane@x\\.com failed$`",
  async () => {
    const { records } = await lateRecord("/late", isoOfEpochMs(nowMs() + HOUR));
    expect(records).toHaveLength(1);
    expect(records[0]?.message ?? "").toMatch(
      /^uncaught exception in work of route \S+: Error #[0-9a-f]{8}( at \S+:\d+)? Error: user jane@x\.com failed$/,
    );
  },
  fixedTime(60_000),
);

test(
  "where `jane@x.com` is a `.pii()` value of that request's input the record ends `Error: user [pii] failed`",
  async () => {
    const { records, text } = await lateRecord("/pii", isoOfEpochMs(nowMs() + HOUR), "jane@x.com");
    expect(records).toHaveLength(1);
    expect((records[0]?.message ?? "").endsWith("Error: user [pii] failed")).toBe(true);
    expect(text).not.toContain("jane");
  },
  fixedTime(60_000),
);

test(
  "after that instant the record ends at the fingerprint or the site, and no line holds `jane`",
  async () => {
    const { records, text } = await lateRecord("/late", isoOfEpochMs(nowMs() - HOUR));
    expect(records).toHaveLength(1);
    expect(records[0]?.message ?? "").toMatch(
      /^uncaught exception in work of route \S+: Error #[0-9a-f]{8}( at \S+:\d+)?$/,
    );
    expect(text).not.toContain("jane");
  },
  fixedTime(60_000),
);
