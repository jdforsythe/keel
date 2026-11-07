// Spec: std.sessions, clause "Each of E2001-E2005 has a fixture that triggers it and a clean counterpart."
// Seed 1337
import { run } from "@keel/cli";
import { describe, expect, test } from "vitest";
import { json, play } from "./fixtures.ts";

// E2004 replay did not reproduce the session's fingerprint (`minimize`, `to-test` stop) (comes from `keel session`)
// Gap: a session that reproduces needs a buggy fixture with a recorded error (none specified); the clean counterpart here is the fingerprint of an error-free session and assumes `reproduced` holds for it.
// TODO 0092: unskip
describe.skip("std.sessions: E2004 has a fixture that triggers it and a clean counterpart", () => {
  const go = (cmd: string, source: string) =>
    run(["session", cmd, "s.json"], { cwd: ".", files: [{ path: "s.json", source }] });

  test("Each of E2001-E2005 has a fixture that triggers it: E2004 when the fingerprint differs", async () => {
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

  test("Each of E2001-E2005 has a clean counterpart: E2004 absent when the fingerprint reproduces", async () => {
    const { session } = await play(1337, [{ id: "cart.add" }]);
    const r = await go("replay", json(session));
    expect(r.stdout).not.toContain("E2004");
  });
});
