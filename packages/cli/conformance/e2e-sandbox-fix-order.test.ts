// Spec: k.e2e-run, clause "In that E1734's fix text `kernel.apparmor_restrict_unprivileged_userns` comes before `CLONE_NEWUSER`, `CLONE_NEWUSER` before `--security-opt seccomp=unconfined`, and `--security-opt seccomp=unconfined` before `--no-sandbox`."
// "That E1734" is the one `keel test --e2e` prints with `KEEL_E2E_SANDBOX=unavailable` (the clause before it); the run is e2e-sandbox-support.ts's, as e2e-sandbox-unavailable.test.ts.
// Seed: n/a (no generated input). SKIPPED as root: the spec's seam clause is "as a non-root user" (e2e-sandbox-unavailable.test.ts).
// ASSUMED: "before" is the first occurrence of each text in the fix, strictly earlier by position.
import { afterAll, describe, expect, it } from "vitest";
import { SLOW, cleanupAll, diags, project, root, run } from "./e2e-sandbox-support.ts";

afterAll(cleanupAll);

const fixText = (): string => {
  const out = run(project(), ["test", "--e2e"], "json", { KEEL_E2E_SANDBOX: "unavailable" });
  const e = diags(out, "E1734");
  expect(e).toHaveLength(1);
  return String(e[0]?.fix);
};
const before = (fix: string, a: string, b: string): void => {
  const i = fix.indexOf(a);
  const j = fix.indexOf(b);
  expect(i, `${a} is in the fix text`).toBeGreaterThanOrEqual(0);
  expect(j, `${b} is in the fix text`).toBeGreaterThanOrEqual(0);
  expect(i, `${a} before ${b}`).toBeLessThan(j);
};

describe("k.e2e-run: the order of E1734's fix text", () => {
  it.skipIf(root)(
    "In that E1734's fix text `kernel.apparmor_restrict_unprivileged_userns` comes before `CLONE_NEWUSER`",
    () => {
      before(fixText(), "kernel.apparmor_restrict_unprivileged_userns", "CLONE_NEWUSER");
    },
    SLOW,
  );

  it.skipIf(root)(
    "In that E1734's fix text `CLONE_NEWUSER` comes before `--security-opt seccomp=unconfined`",
    () => {
      before(fixText(), "CLONE_NEWUSER", "--security-opt seccomp=unconfined");
    },
    SLOW,
  );

  it.skipIf(root)(
    "In that E1734's fix text `--security-opt seccomp=unconfined` comes before `--no-sandbox`",
    () => {
      before(fixText(), "--security-opt seccomp=unconfined", "--no-sandbox");
    },
    SLOW,
  );
});
