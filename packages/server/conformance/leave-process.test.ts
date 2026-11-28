// k.leave, Process "The production entry (`server.mjs`, k.deploy) and `keel dev` handle every `uncaughtException` and `unhandledRejection`; `createApp` adds no process listener, so a process that embeds it chooses its own. Each writes one `diag` record E1577 `uncaught <exception|rejection> in work of route <id>`, the route id of the request whose async context the failing work ran in, else `-`, with the error's `frames` (k.deploy) and no thrown text. In production the first one then stops the server listening, lets requests in flight finish for at most 10,000 ms, calls `close()` (k.topology) and the storage driver's `close()`, and exits 1, so a supervisor restarts it; a later one during that drain writes its record and changes nothing else. `keel dev` appends the thrown text, scrubbed and cut (k.serverlog), and keeps serving."
// k.leave, Rules "E1577 an uncaught exception or unhandled rejection in a served process."
// Spec: k.leave, clause "`server.mjs` of a fixture whose loader `/late` schedules a throw 30 ms after its 200: one E1577 json `diag` naming route `late` and not the thrown text; a new connection is then refused, a request in flight completes, and the process exits 1 within 11 s. A rejection at module scope names route `-`."
// Spec: k.leave, clause "Under `keel dev` the same throw writes one E1577 holding the thrown text, and a later GET answers 200."
// Seed: 1337 (no generated inputs: every case is a fixed process scenario). Spawns the built `server.mjs` of a `keel build`
// fixture in json format on a port the OS just freed (never a fixed one); each child is killed in `afterEach`.
// Waits are on the child's output and exit events and on bounded retries. The clock is not read: the 11 s of the clause
// is the test's own timeout, and the drain bound (10,000 ms) is exercised with a request that never ends.
// The dev half of the Process clauses is in packages/cli/conformance/dev-uncaught.test.ts.
import fs from "node:fs";
import { fixedTime, testTime } from "@keel/tooling/test-time";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  type Server,
  THROWN,
  buildLeaveFixture,
  listening,
  refused,
  startServer,
  statusOf,
} from "./leave-process-fixture.ts";

let fixture = "";
const started: Server[] = [];
beforeAll(() => {
  fixture = buildLeaveFixture();
}, fixedTime(120_000));
afterAll(() => fs.rmSync(fixture, { recursive: true, force: true }));
afterEach(() => {
  for (const server of started.splice(0)) server.stop();
});

async function up(extra: Record<string, string> = {}): Promise<Server> {
  const server = await startServer(fixture, extra);
  started.push(server);
  expect(await listening(server), server.text()).toBe(true);
  return server;
}

const GET = (server: Server, pathname: string): Promise<number> => statusOf(server.port, pathname);
/** Each case ends within this bound: the exit the clauses name is at most 11 s after the record, startup is a second or two. */
const SLOW = 20_000;
/**
 * The drain the clause names: the server waits 10,000 ms for a request that never ends. That wait is the server's own
 * time, so it does not scale; the startup and requests around it take the case's scaled bound.
 */
const DRAIN = 10_000;

describe("k.leave Process: server.mjs handles an uncaught exception or rejection with one E1577 record, drains and exits 1", () => {
  test(
    "`/late` answers 200 and throws 30 ms later: one E1577 json diag naming route `app.late` and not the thrown text; a new connection is then refused, a request in flight completes, and the process exits 1 within 11 s",
    async () => {
      const server = await up();
      const inFlight = fetch(`http://127.0.0.1:${server.port}/slow`).then((r) => r.status);
      expect(await server.until(() => server.text().includes("slow-started"))).toBe(true);
      expect(await GET(server, "/late")).toBe(200);
      expect(await server.until(() => server.e1577().length > 0)).toBe(true);

      let closed = false;
      for (let i = 0; i < 20_000 && !closed && server.child.exitCode === null; i++) closed = await refused(server.port);
      expect(closed).toBe(true);
      expect(await inFlight).toBe(200);
      const code = await server.exited;
      expect(code).toBe(1);

      const records = server.e1577();
      expect(records).toHaveLength(1);
      expect(records[0]?.message).toContain("uncaught exception in work of route app.late");
      expect(server.text()).not.toContain(THROWN);
      expect(Array.isArray(records[0]?.frames)).toBe(true);
    },
    SLOW,
  );

  test(
    "the drain is bounded: a request that never ends does not keep the process from exiting 1 within the test bound",
    async () => {
      const server = await up();
      void fetch(`http://127.0.0.1:${server.port}/hang`).catch(() => 0);
      void fetch(`http://127.0.0.1:${server.port}/late`).catch(() => 0);
      expect(await server.until(() => server.e1577().length > 0)).toBe(true);
      expect(await server.exited).toBe(1);
    },
    fixedTime(DRAIN) + testTime(SLOW),
  );

  test(
    "a rejection at module scope names route `-`, the process exits 1 and the thrown text is not written",
    async () => {
      const server = await startServer(fixture, { LEAVE_MODE: "reject" });
      started.push(server);
      expect(await server.until(() => server.e1577().length > 0)).toBe(true);
      expect(await server.exited).toBe(1);
      const records = server.e1577();
      expect(records).toHaveLength(1);
      expect(records[0]?.message).toContain("uncaught rejection in work of route -");
      expect(records[0]?.message ?? "").not.toContain(THROWN);
    },
    SLOW,
  );

  test(
    "two throws while a request is in flight: the drain is still running at the second, which writes its record and changes nothing else: two E1577 records, exit 1",
    async () => {
      const server = await up();
      void fetch(`http://127.0.0.1:${server.port}/hang`).catch(() => 0);
      expect(await server.until(() => server.text().includes("hang-started"))).toBe(true);
      expect(await GET(server, "/twice")).toBe(200);
      expect(await server.until(() => server.e1577().length >= 2)).toBe(true);
      expect(server.child.exitCode).toBeNull();
      expect(await server.exited).toBe(1);
      const records = server.e1577();
      expect(records).toHaveLength(2);
      for (const r of records) expect(r.message).toContain("uncaught exception in work of route app.twice");
      expect(server.text()).not.toContain(THROWN);
    },
    fixedTime(DRAIN) + testTime(SLOW),
  );

  test(
    "negative: a server that is never sent a throwing request keeps serving and writes no E1577",
    async () => {
      const server = await up();
      for (let i = 0; i < 5; i++) expect(await GET(server, "/")).toBe(200);
      expect(server.e1577()).toEqual([]);
      expect(server.child.exitCode).toBeNull();
    },
    SLOW,
  );
});
