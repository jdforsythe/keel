// Spec: k.serverlog, clause "`server.mjs` of a fixture whose loader `/late` throws `new Error('user jane@x.com failed')` 30 ms after its 200 writes one E1577 record whose message matches `^uncaught exception in work of route \S+: Error #[0-9a-f]{8}( at \S+:\d+)?$`, and no line the process writes holds `jane`."
// Seed: 1337 (no generated inputs: one fixed process scenario). Spawns the built `server.mjs` of the leave-process fixture in json format
// on a port the OS just freed; the child is killed in `afterEach`. Waits are on the child's output and exit, never on a clock.
import fs from "node:fs";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { type Server, buildLeaveFixture, listening, startServer, statusOf } from "./leave-process-fixture.ts";

let fixture = "";
const started: Server[] = [];
beforeAll(() => {
  fixture = buildLeaveFixture();
}, fixedTime(120_000));
afterAll(() => fs.rmSync(fixture, { recursive: true, force: true }));
afterEach(() => {
  for (const server of started.splice(0)) server.stop();
});

test(
  "`server.mjs` of a fixture whose loader `/late` throws `new Error('user jane@x.com failed')` 30 ms after its 200 writes one E1577 record whose message matches `^uncaught exception in work of route \\S+: Error #[0-9a-f]{8}( at \\S+:\\d+)?$`, and no line the process writes holds `jane`",
  async () => {
    const server = await startServer(fixture, { LEAVE_THROW: "error" });
    started.push(server);
    expect(await listening(server), server.text()).toBe(true);
    expect(await statusOf(server.port, "/late")).toBe(200);
    expect(await server.until(() => server.e1577().length > 0)).toBe(true);
    await server.exited;
    const records = server.e1577();
    expect(records).toHaveLength(1);
    expect(records[0]?.message ?? "").toMatch(/^uncaught exception in work of route \S+: Error #[0-9a-f]{8}( at \S+:\d+)?$/);
    expect(server.text()).not.toContain("jane");
  },
  fixedTime(60_000),
);
