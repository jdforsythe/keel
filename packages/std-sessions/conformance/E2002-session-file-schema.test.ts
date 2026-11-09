// Spec: std.sessions, clause "E2002 fires on a fixture, not on its clean twin."
// Seed 1337
import { run } from "@keel/cli";
import { describe, expect, test } from "vitest";
import { json, play } from "./fixtures.ts";

// E2002 session file fails `sessions.Session` (comes from `keel session`)
// Gap: the spec names no stdout record shape for `keel session replay` diagnostics; the test only looks for the code in stdout.
// TODO 0094: unskip (keel session replay/minimize/to-test are backlog 0094)
describe.skip("std.sessions: E2002 fires on a fixture, not on its clean twin", () => {
  const replayOf = (source: string) =>
    run(["session", "replay", "s.json"], { cwd: ".", files: [{ path: "s.json", source }] });

  test("E2002 fires on a fixture: E2002 for a session file that fails sessions.Session", async () => {
    const r = await replayOf(JSON.stringify({ v: 2 }));
    expect(r.stdout + r.stderr).toContain("E2002");
  });

  test("E2002 does not fire on its clean twin: E2002 absent for a valid session file", async () => {
    const { session } = await play(1337, [{ id: "cart.add" }]);
    const r = await replayOf(json(session));
    expect(r.stdout + r.stderr).not.toContain("E2002");
  });
});
