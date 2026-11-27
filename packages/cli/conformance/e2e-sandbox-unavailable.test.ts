// Spec: k.e2e-run, clause "`keel test --e2e` with `KEEL_E2E_SANDBOX=unavailable`, as a non-root user, prints one E1734 `chromium cannot start its sandbox here` whose fix text holds `kernel.apparmor_restrict_unprivileged_userns`, `kernel.unprivileged_userns_clone`, `CLONE_NEWUSER` and `--no-sandbox`, runs no test, reports none skipped and exits 1."
// k.e2e-run Rules: "E1734 the browser is missing, or Chromium cannot start its sandbox" (the code is asserted by the `r.code === "E1734"` filter below).
// k.e2e-run Browser: "Where it cannot (Linux refusing unprivileged user namespaces: a non-root container, a hardened runner), the run fails before any file with one E1734 `chromium cannot start its sandbox here`, whose fix text names the settings: `sysctl kernel.apparmor_restrict_unprivileged_userns=0` (Ubuntu 23.10 and later), `sysctl kernel.unprivileged_userns_clone=1` (Debian), a container seccomp profile that allows `clone` with `CLONE_NEWUSER`, or `--no-sandbox` to accept an unsandboxed browser."
// k.e2e-run Browser: "`KEEL_E2E_SANDBOX=unavailable` in the run's environment makes the check fail as a refused user namespace does, without launching, for a test of that path; no value of it turns the sandbox off."
// Seed: n/a (no generated input). Method: e2e-sandbox-support.ts: the real `keel test --e2e` over a project whose e2e file writes `ran.marker` when it runs, with `KEEL_E2E_SANDBOX=unavailable` (the one seam the spec states); "no browser test runs unsandboxed silently" is read from the run's result and output:
// exit 1, one E1734, no W1734 (the sandbox was not turned off), the e2e file did not run (no marker), no `e2e.json` report, none reported skipped. "Without launching" is not observable beyond that: the seam makes the check fail without a browser, so the cases need no Chromium.
// SKIPPED with a stated reason: as root the clause's "non-root user" does not hold, so the cases do not run under a root user (the seam's behavior as root is not stated).
import { afterAll, describe, expect, it } from "vitest";
import { SLOW, cleanupAll, diags, project, ran, reports, root, run } from "./e2e-sandbox-support.ts";

afterAll(cleanupAll);
const SEAM = { KEEL_E2E_SANDBOX: "unavailable" };
const FIX = [
  "kernel.apparmor_restrict_unprivileged_userns",
  "kernel.unprivileged_userns_clone",
  "CLONE_NEWUSER",
  "--no-sandbox",
];

describe("k.e2e-run: a sandbox that cannot start", () => {
  it.skipIf(root)(
    "`keel test --e2e` with `KEEL_E2E_SANDBOX=unavailable`, as a non-root user, prints one E1734 `chromium cannot start its sandbox here` whose fix text holds `kernel.apparmor_restrict_unprivileged_userns`, `kernel.unprivileged_userns_clone`, `CLONE_NEWUSER` and `--no-sandbox`, runs no test, reports none skipped and exits 1",
    () => {
      const dir = project();
      const out = run(dir, ["test", "--e2e"], "json", SEAM);
      expect(out.status, out.stdout.slice(-1500)).toBe(1);
      const e = diags(out, "E1734");
      expect(e).toHaveLength(1);
      expect(String(e[0]?.message)).toBe("chromium cannot start its sandbox here");
      for (const part of FIX) expect(String(e[0]?.fix), part).toContain(part);
      expect(diags(out, "W1734")).toEqual([]);
      expect(ran(dir)).toBe(false);
      expect(reports(dir)).not.toContain("e2e.json");
      const summary = out.records.filter((r) => r.kind === "summary").at(-1);
      expect(summary?.skipped ?? 0).toBe(0);
      expect(summary?.tests ?? 0).toBe(0);
    },
    SLOW,
  );

  it.skipIf(root)(
    "the refusal is one E1734 line in the compact output too, and no test and no W1734 line follows it",
    () => {
      const dir = project();
      const out = run(dir, ["test", "--e2e"], "compact", SEAM);
      expect(out.status).toBe(1);
      const lines = out.stdout.split("\n");
      expect(lines.filter((l) => l.includes("E1734"))).toHaveLength(1);
      // The E1734 fix text names W1734 as written (k.e2e-run Browser: "an unsandboxed browser with W1734 on every run"), so only a diagnostic line that begins with W1734 is a warning.
      expect(lines.filter((l) => l.startsWith("W1734"))).toEqual([]);
      expect(lines.some((l) => l.includes("chromium cannot start its sandbox here"))).toBe(true);
      expect(ran(dir)).toBe(false);
    },
    SLOW,
  );

  it.skipIf(root)(
    "the refusal comes with an explicit `--engine chromium` and with paths narrowing the run, and every time the run is repeated",
    () => {
      const dir = project();
      for (const args of [
        ["test", "--e2e", "--engine", "chromium"],
        ["test", "--e2e", "test/b.e2e.ts"],
        ["test", "--e2e"],
      ]) {
        const out = run(dir, args, "json", SEAM);
        expect(out.status, args.join(" ")).toBe(1);
        expect(diags(out, "E1734"), args.join(" ")).toHaveLength(1);
        expect(ran(dir), args.join(" ")).toBe(false);
      }
    },
    SLOW,
  );
});
