// @vitest-environment happy-dom
// Spec: std.sessions, clause "E2001-E2005 each fire on a fixture, not on its clean twin." (E2002)
// Seed 1337
import { run } from "@keel/cli";
import "@keel/std-sessions/tools";
import { describe, expect, test } from "vitest";
import { json, play } from "./fixtures.ts";

// E2002 session file fails `sessions.Session` (comes from `keel session`)
describe("std.sessions: E2002 fires on a fixture, not on its clean twin", () => {
  const replayOf = (source: string) =>
    run(["session", "replay", "s.json"], { cwd: ".", files: [{ path: "s.json", source }] });

  test("E2002 fires on a fixture: E2002 for a session file that fails sessions.Session", async () => {
    const r = await replayOf(JSON.stringify({ v: 2 }));
    expect(r.stdout).toContain("E2002");
    expect(r.code).toBe(1);
  }, 60_000);

  test("E2002 does not fire on its clean twin: E2002 absent for a valid session file (E2003 for the missing base)", async () => {
    const { session } = await play(1337, [{ id: "cart.add" }]);
    const r = await replayOf(json(session));
    expect(r.stdout).not.toContain("E2002");
    expect(r.stdout).toContain("E2003");
  }, 60_000);
});
