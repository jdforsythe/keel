import { operations } from "../operations.ts";
import { hostIo } from "./hostIo.ts";
import { parseArgv } from "./parseArgv.ts";
import { portBusy } from "./portBusy.ts";
import { portDiag } from "./portDiag.ts";
import { respond } from "./respond.ts";
import { summary } from "./summary.ts";
import { viteRun } from "./viteRun.ts";

/** The port `keel dev` serves on without `--port`. */
export const DEFAULT_DEV_PORT = 5173;

/**
 * Binary only: `keel dev` over a Vite project. Flags are parsed and validated by the `dev` input schema; a port that
 * will not bind is one E1560 line (exit 1) and Vite is never started, so it cannot move to another port; otherwise
 * Vite gets the port with `--strictPort`. Undefined when the engine answers instead: no `vite.config.ts`, or flags
 * that do not parse (E1052).
 */
export async function devStart(
  argv: readonly string[],
  cwd: string,
): Promise<{ readonly code: number; readonly stdout: string } | undefined> {
  const parsed = parseArgv(argv, operations);
  if (!parsed.ok || parsed.op.name !== "dev") return undefined;
  const port = parsed.input.port ?? DEFAULT_DEV_PORT;
  if (await portBusy(port)) {
    const diag = portDiag(port);
    const r = respond([diag, summary("dev", [diag], { errors: 1 })], hostIo(false), {
      command: "dev",
      format: parsed.input.format,
      quiet: parsed.input.quiet,
      limit: parsed.input.limit,
      verbose: parsed.input.verbose,
      code: parsed.input.code,
    });
    return { code: r.code, stdout: r.stdout };
  }
  const vite = viteRun(cwd, "dev", undefined, port);
  return vite === undefined ? undefined : { code: vite.code, stdout: "" };
}
