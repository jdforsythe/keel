import { spawnSync } from "node:child_process";

/** Binary only: `keel test [paths]` runs the vitest harness with KEEL_TEST=1 (k.testing) and returns its exit code. */
export function delegateTest(paths: readonly string[]): number {
  const r = spawnSync("npx", ["--no-install", "vitest", "run", ...paths], {
    stdio: "inherit",
    env: { ...process.env, KEEL_TEST: "1" },
  });
  return r.status ?? 1;
}
