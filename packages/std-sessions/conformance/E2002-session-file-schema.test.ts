// Spec: std.sessions, clause "Each of E2001-E2005 has a fixture that triggers it and a clean counterpart."
// Seed 1337
import { run } from "@keel/cli";
import { describe, expect, test } from "vitest";
import { json, play } from "./fixtures.ts";

// E2002 session file fails `sessions.Session` (comes from `keel session`)
// Gap: the spec names no stdout record shape for `keel session replay` diagnostics; the test only looks for the code in stdout.
// TODO 0092: unskip
describe.skip("std.sessions: E2002 has a fixture that triggers it and a clean counterpart", () => {
  const replayOf = (source: string) =>
    run(["session", "replay", "s.json"], { cwd: ".", files: [{ path: "s.json", source }] });

  test("Each of E2001-E2005 has a fixture that triggers it: E2002 for a session file that fails sessions.Session", async () => {
    const r = await replayOf(JSON.stringify({ v: 2 }));
    expect(r.stdout + r.stderr).toContain("E2002");
  });

  test("Each of E2001-E2005 has a clean counterpart: E2002 absent for a valid session file", async () => {
    const { session } = await play(1337, [{ id: "cart.add" }]);
    const r = await replayOf(json(session));
    expect(r.stdout + r.stderr).not.toContain("E2002");
  });
});
