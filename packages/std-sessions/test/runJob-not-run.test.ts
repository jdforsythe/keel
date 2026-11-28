// A `keel session` job whose test file the project's vitest `include` misses reports E1052 and leaves nothing behind.
// Seed 1337
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, test, vi } from "vitest";

vi.mock("@keel/cli", async (importOriginal) => {
  const real = await importOriginal<typeof import("@keel/cli")>();
  return { ...real, run: async () => ({ code: 1, stdout: "", stderr: "" }) };
});

const { runJob } = await import("../src/internal/runJob.ts");

const cwd = tempDir("keel-runjob-");
afterAll(() => rmSync(cwd, { recursive: true, force: true }));

describe("std.sessions: runJob without a result", () => {
  test.each(["replay", "minimize", "to-test"] as const)(
    "%s reports E1052 with a fix when the job never ran",
    async (op) => {
      const r = await runJob({ cwd }, { op, session: {}, modules: ["app"], expose: [], redact: [] });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.diags).toHaveLength(1);
      expect(r.diags[0]).toMatchObject({
        kind: "diag",
        code: "E1052",
        message: `session ${op}: the job test did not run; add ".keel/sessions/*.test.ts" to vitest include`,
      });
      expect(String(r.diags[0]?.fix)).toContain(".keel/sessions/*.test.ts");
      expect(existsSync(path.join(cwd, ".keel", "sessions"))).toBe(true);
      expect(readdirSync(path.join(cwd, ".keel", "sessions"))).toEqual([]);
    },
  );
});
