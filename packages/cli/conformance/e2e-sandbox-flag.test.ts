// Spec: k.e2e-run, clause "The same run with `--no-sandbox` prints one W1734 `chromium sandbox off: --no-sandbox` and runs its tests, and a second such run prints it again."
// k.e2e-run Rules: "W1734 the Chromium sandbox is off (as root on Linux, or `--no-sandbox`)." (the code is asserted by the `r.code === "W1734"` filter below).
// k.e2e-run Browser: "`keel test --e2e --no-sandbox` is the one way to run without it, a flag with no environment value or config key, and it prints W1734 `chromium sandbox off: --no-sandbox` on every run."
// k.e2e Files: "`keel test --e2e [paths] [--engine chromium|firefox|webkit] [--no-sandbox]` (k.e2e-run Browser) runs them alone".
// Seed: n/a (no generated input). Method: e2e-sandbox-support.ts: the real `keel test --e2e --no-sandbox` over a project whose e2e file writes `ran.marker` when it runs. "The same run" is the run of the `unavailable` clause (KEEL_E2E_SANDBOX=unavailable, non-root), now with the flag; the marker is removed between runs so the second run's tests are seen to run.
// The cases need `playwright-core` and Chromium installed (the browser check is not the sandbox check); none skips for that. SKIPPED with a stated reason: under a root user the flag half of the run is not the one the clause names (root prints its own W1734), so the cases run as non-root only.
// ASSUMED: with the seam and the flag together the flag wins (the clause says the same run "with `--no-sandbox`" prints W1734 and runs its tests); a W1734 diagnostic holds the message text as its `message`.
// SILENT (reported, not asserted): a config key or environment value that would take the place of the flag. The text says there is none; no case can name one.
import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { MARKER, SLOW, cleanupAll, diags, project, ran, reports, root, run } from "./e2e-sandbox-support.ts";

afterAll(cleanupAll);
const SEAM = { KEEL_E2E_SANDBOX: "unavailable" };
const TEXT = "chromium sandbox off: --no-sandbox";

describe("k.e2e-run: --no-sandbox", () => {
  it.skipIf(root)(
    "The same run with `--no-sandbox` prints one W1734 `chromium sandbox off: --no-sandbox` and runs its tests, and a second such run prints it again",
    () => {
      const dir = project();
      for (const round of [1, 2]) {
        rmSync(join(dir, MARKER), { force: true });
        const out = run(dir, ["test", "--e2e", "--no-sandbox"], "json", SEAM);
        expect(out.status, `run ${round}: ${out.stdout.slice(-1500)}`).toBe(0);
        const w = diags(out, "W1734");
        expect(w, `run ${round}`).toHaveLength(1);
        expect(String(w[0]?.message), `run ${round}`).toBe(TEXT);
        expect(diags(out, "E1734"), `run ${round}`).toEqual([]);
        expect(ran(dir), `run ${round}`).toBe(true);
        expect(reports(dir)).toContain("e2e.json");
      }
    },
    SLOW,
  );

  it.skipIf(root)(
    "`--no-sandbox` prints one W1734 on every run where the sandbox could have started too, and runs the tests",
    () => {
      const dir = project();
      for (const round of [1, 2, 3]) {
        rmSync(join(dir, MARKER), { force: true });
        const out = run(dir, ["test", "--e2e", "--no-sandbox"], "compact");
        expect(out.status, `run ${round}: ${out.stdout.slice(-1500)}`).toBe(0);
        const lines = out.stdout.split("\n").filter((l) => l.includes("W1734"));
        expect(lines, `run ${round}`).toHaveLength(1);
        expect(lines[0], `run ${round}`).toContain(TEXT);
        expect(out.stdout.includes("E1734"), `run ${round}`).toBe(false);
        expect(ran(dir), `run ${round}`).toBe(true);
      }
    },
    SLOW,
  );

  it.skipIf(root)(
    "a run without `--no-sandbox` prints no W1734 for it, with the seam value `unavailable` or none",
    () => {
      const dir = project();
      const plain = run(dir, ["test", "--e2e"], "json");
      expect(diags(plain, "W1734").filter((r) => String(r.message).includes("--no-sandbox"))).toEqual([]);
      const seam = run(dir, ["test", "--e2e"], "json", SEAM);
      expect(diags(seam, "W1734")).toEqual([]);
      expect(seam.status).toBe(1);
    },
    SLOW,
  );
});
