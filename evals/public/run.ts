// One place that runs commands for the public mode: a command to its end, the last 4,000 characters of its output.
import { execFile } from "node:child_process";

export type Step = { ok: boolean; output: string };

/** Runs `cmd` to its end. `KEEL_AGENT=1` and `CI=1` keep every tool's output compact and non-interactive. */
export function sh(
  cmd: string,
  args: readonly string[],
  cwd: string,
  env: Readonly<Record<string, string>> = {},
  timeoutMs = 600_000,
): Promise<Step> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      [...args],
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, ...env, KEEL_AGENT: "1", CI: "1" },
      },
      (err, stdout, stderr) => resolve({ ok: err === null, output: `${stdout}${stderr}`.slice(-4_000) }),
    );
  });
}

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
