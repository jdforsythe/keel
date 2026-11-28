// Spec: k.e2e-run, clause "`KEEL_E2E_SANDBOX=on` or any value but `unavailable` changes nothing: a run where the sandbox starts prints no E1734 and no W1734."
// k.e2e-run Browser: "`KEEL_E2E_SANDBOX=unavailable` in the run's environment makes the check fail as a refused user namespace does, without launching, for a test of that path; no value of it turns the sandbox off."
// Seed 1337 (fast-check chooses the values; `numRuns` is small because each run is a build, a browser check and a vitest run). Method: e2e-sandbox-support.ts: the real `keel test --e2e` over a project whose e2e file writes `ran.marker`, with `KEEL_E2E_SANDBOX` set to a value other than `unavailable`.
// The cases need `playwright-core` and a Chromium that starts its sandbox as this user (a non-root user on a machine that allows it); none skips for that, so a machine that cannot is a failing case, by the clause. SKIPPED with a stated reason: as root a run prints its own W1734, so the cases run as non-root only.
// ASSUMED: "changes nothing" is read as the result of a run with the variable unset: exit 0, no E1734, no W1734, the test ran.
import { rmSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { MARKER, SEED, SLOW, cleanupAll, diags, project, ran, root, run } from "./e2e-sandbox-support.ts";

afterAll(cleanupAll);

describe("k.e2e-run: other values of the seam", () => {
  it.skipIf(root)(
    "`KEEL_E2E_SANDBOX=on` or any value but `unavailable` changes nothing: a run where the sandbox starts prints no E1734 and no W1734",
    async () => {
      const dir = project();
      const check = (value: string): void => {
        rmSync(join(dir, MARKER), { force: true });
        const out = run(dir, ["test", "--e2e"], "json", { KEEL_E2E_SANDBOX: value });
        expect(out.status, `${JSON.stringify(value)}: ${out.stdout.slice(-1500)}`).toBe(0);
        expect(diags(out, "E1734"), JSON.stringify(value)).toEqual([]);
        expect(diags(out, "W1734"), JSON.stringify(value)).toEqual([]);
        expect(ran(dir), JSON.stringify(value)).toBe(true);
      };
      check("on");
      check("UNAVAILABLE");
      await fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z0-9_-]{1,12}$/).filter((v) => v !== "unavailable"),
          (v) => {
            check(v);
          },
        ),
        { seed: SEED, numRuns: 3 },
      );
    },
    SLOW * 2,
  );

  it.skipIf(root)(
    "no value of `KEEL_E2E_SANDBOX` makes a run print W1734 or run with the sandbox off",
    () => {
      const dir = project();
      for (const value of ["off", "0", "no-sandbox"]) {
        const out = run(dir, ["test", "--e2e"], "json", { KEEL_E2E_SANDBOX: value });
        expect(diags(out, "W1734"), value).toEqual([]);
        expect(String(out.stdout).includes("--no-sandbox"), value).toBe(false);
      }
    },
    SLOW * 2,
  );
});
