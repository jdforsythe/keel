// Spec: std.sessions, clause "The `to-test` file passes `keel check`, fails under `keel test` on the buggy fixture, and passes once the fix is applied."
// Seed 1337
import { describe, expect, test } from "vitest";
import { check } from "@keel/check";
import { run } from "@keel/cli";

// Gap: the spec has no buggy fixture project (modules, session file, fix), and no programmatic way to run the emitted test under `keel test` except `run(["test"], io)` with a cwd on disk; the fix must be a named patch.
// TODO 0092: unskip
describe.skip("std.sessions: to-test", () => {
  const emit = async (): Promise<{ path: string; source: string }> => {
    const writes: { path: string; content: string | null }[] = [];
    await run(["session", "to-test", "failing.json"], {
      cwd: ".",
      files: [{ path: "failing.json", source: "{}" }],
      apply: (w) => void writes.push(...w),
    });
    const w = writes.find((x) => /^modules\/[^/]+\/test\/session-[0-9a-f]{12}\.test\.ts$/.test(x.path));
    if (w === undefined || w.content === null) throw new Error("no session test written");
    return { path: w.path, source: w.content };
  };

  test("The `to-test` file passes `keel check`", async () => {
    const f = await emit();
    expect(check([f]).summary).toMatchObject({ errors: 0 });
  });

  test("The `to-test` file fails under `keel test` on the buggy fixture", async () => {
    const r = await run(["test"], { cwd: "buggy-fixture", files: [] });
    expect(r.code).toBe(1);
  });

  test("The `to-test` file passes once the fix is applied", async () => {
    const r = await run(["test"], { cwd: "fixed-fixture", files: [] });
    expect(r.code).toBe(0);
  });
});
