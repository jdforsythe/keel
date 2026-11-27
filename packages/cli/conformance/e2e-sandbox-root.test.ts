// Spec: k.e2e-run, clause "A run under a non-root user on Linux or macOS launches Chromium with its sandbox on and prints no W1734; the same run as root on Linux prints one W1734 `chromium sandbox off: running as root` and passes."
// k.e2e-run Browser: "On Linux as root, where Chromium refuses its sandbox, the run does so without the flag and prints W1734 `chromium sandbox off: running as root` on every run."
// k.e2e-run Rules: "W1734 the Chromium sandbox is off (as root on Linux, or `--no-sandbox`)."
// Seed: n/a (no generated input). Method: e2e-sandbox-support.ts: the real `keel test --e2e` over a project whose e2e file writes `ran.marker` when it runs, run twice.
// The root-only case is SKIPPED with a stated reason: it needs a root user on Linux (`process.getuid() === 0`), as the first case of packages/testing/conformance/e2e-run.test.ts says; the non-root case needs the opposite and is skipped as root.
// ASSUMED: a W1734 diagnostic holds the message text as its `message`; without the seam a non-root run on a machine whose Chromium starts its sandbox prints no W1734.
import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { MARKER, SLOW, cleanupAll, diags, project, ran, root, rootLinux, run } from "./e2e-sandbox-support.ts";

afterAll(cleanupAll);

describe("k.e2e-run: running as root", () => {
  it.skipIf(!rootLinux)(
    "As root on Linux the run prints W1734 `chromium sandbox off: running as root` without `--no-sandbox` on every run, and passes",
    () => {
      const dir = project();
      for (const round of [1, 2]) {
        rmSync(join(dir, MARKER), { force: true });
        const out = run(dir, ["test", "--e2e"], "json");
        expect(out.status, `run ${round}: ${out.stdout.slice(-1500)}`).toBe(0);
        const w = diags(out, "W1734");
        expect(w, `run ${round}`).toHaveLength(1);
        expect(String(w[0]?.message), `run ${round}`).toBe("chromium sandbox off: running as root");
        expect(diags(out, "E1734"), `run ${round}`).toEqual([]);
        expect(ran(dir), `run ${round}`).toBe(true);
      }
    },
    SLOW,
  );

  it.skipIf(root)(
    "a run under a non-root user prints no W1734 and no E1734 where the sandbox starts, and runs its tests",
    () => {
      const dir = project();
      const out = run(dir, ["test", "--e2e"], "json");
      expect(out.status, out.stdout.slice(-1500)).toBe(0);
      expect(diags(out, "W1734")).toEqual([]);
      expect(diags(out, "E1734")).toEqual([]);
      expect(ran(dir)).toBe(true);
    },
    SLOW,
  );
});
