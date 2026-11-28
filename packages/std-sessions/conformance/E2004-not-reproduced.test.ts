// @vitest-environment happy-dom
// Spec: std.sessions, clause "E2001-E2005 each fire on a fixture, not on its clean twin." (E2004)
// Seed 1337
import { fixedTime } from "@keel/tooling/test-time";
import { run } from "@keel/cli";
import "@keel/std-sessions/tools";
import { afterAll, describe, expect, test } from "vitest";
import { buggySession, diskFixture, sessionFile } from "./fixtures.ts";

// E2004 replay did not reproduce the session's fingerprint (`minimize`, `to-test` stop) (comes from `keel session`)
describe("std.sessions: E2004 fires on a fixture, not on its clean twin", () => {
  const fx = diskFixture();
  afterAll(() => fx.dispose());

  const go = async (cmd: string, fingerprint: string | null) => {
    const good = await buggySession();
    fx.write("sessions/s.json", sessionFile(fingerprint === null ? good : { ...good, fingerprint }));
    const writes: unknown[] = [];
    const r = await run(["session", cmd, "sessions/s.json"], {
      cwd: fx.dir,
      files: fx.files(),
      apply: (w) => void writes.push(...w),
    });
    return { r, writes };
  };

  test(
    "E2004 fires on a fixture: E2004 when the fingerprint differs",
    async () => {
      const { r } = await go("replay", "ffffffffffff");
      expect(r.stdout).toContain("E2004");
    },
    fixedTime(120_000),
  );

  test(
    "E2004 stops minimize and to-test: no file is written",
    async () => {
      for (const cmd of ["minimize", "to-test"]) {
        const { r, writes } = await go(cmd, "ffffffffffff");
        expect(r.stdout, cmd).toContain("E2004");
        expect(writes, cmd).toEqual([]);
      }
    },
    fixedTime(120_000),
  );

  test(
    "E2004 does not fire on its clean twin: E2004 absent when the fingerprint reproduces",
    async () => {
      const { r } = await go("replay", null);
      expect(r.stdout).not.toContain("E2004");
      expect(r.code).toBe(0);
    },
    fixedTime(120_000),
  );
});
