import { mkdirSync } from "node:fs";
import { join } from "node:path";

/** The names a served process takes from the run's environment when they are set, and no other (k.e2e-run Environment). */
const PASSED: readonly string[] = [
  "PATH",
  "LANG",
  "LC_ALL",
  "TZ",
  ...(process.platform === "win32" ? ["SystemRoot"] : []),
];

/**
 * The allowlisted names of the run's environment, then `HOME`, `TMPDIR`, `TMP` and `TEMP` at folders made inside
 * `data` (k.e2e-run Environment): what a served process or the browser gets before the runner's own names.
 */
export function baseEnv(data: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const k of PASSED) {
    const v = process.env[k];
    if (v !== undefined) env[k] = v;
  }
  const home = join(data, "home");
  const tmp = join(data, "tmp");
  mkdirSync(home, { recursive: true });
  mkdirSync(tmp, { recursive: true });
  env.HOME = home;
  env.TMPDIR = tmp;
  env.TMP = tmp;
  env.TEMP = tmp;
  return env;
}
