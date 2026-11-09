// Spec: std.sessions, clause "E2004 fires on a fixture, not on its clean twin."
// Seed 1337
import { run } from "@keel/cli";
import { describe, expect, test } from "vitest";
import { json, play } from "./fixtures.ts";

// E2004 replay did not reproduce the session's fingerprint (`minimize`, `to-test` stop) (comes from `keel session`)
// Gap: a session that reproduces needs a buggy fixture with a recorded error (none specified); the clean counterpart here is the fingerprint of an error-free session and assumes `reproduced` holds for it.
// TODO 0094: unskip (keel session replay/minimize/to-test are backlog 0094)
describe.skip("std.sessions: E2004 fires on a fixture, not on its clean twin", () => {
  const go = (cmd: string, source: string) =>
    run(["session", cmd, "s.json"], { cwd: ".", files: [{ path: "s.json", source }] });

  test("E2004 fires on a fixture: E2004 when the fingerprint differs", async () => {
    const { session } = await play(1337, [{ id: "cart.add" }]);
    const r = await go("replay", json({ ...session, fingerprint: "ffffffffffff" }));
    expect(r.stdout).toContain("E2004");
  });

  test("E2004 stops minimize and to-test", async () => {
    const { session } = await play(1337, [{ id: "cart.add" }]);
    const source = json({ ...session, fingerprint: "ffffffffffff" });
    for (const cmd of ["minimize", "to-test"]) {
      const writes: unknown[] = [];
      const r = await run(["session", cmd, "s.json"], {
        cwd: ".",
        files: [{ path: "s.json", source }],
        apply: (w) => void writes.push(...w),
      });
      expect(r.stdout).toContain("E2004");
      expect(writes).toEqual([]);
    }
  });

  test("E2004 does not fire on its clean twin: E2004 absent when the fingerprint reproduces", async () => {
    const { session } = await play(1337, [{ id: "cart.add" }]);
    const r = await go("replay", json(session));
    expect(r.stdout).not.toContain("E2004");
  });
});
