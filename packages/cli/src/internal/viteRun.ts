import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { keelLines } from "./keelLines.ts";

/**
 * Binary only: bundle or serve with Vite when the project has `vite.config.ts`. `build` captures Vite's output
 * and returns its last lines only on failure (OUTPUT.md: success is silent), and on success its Keel-coded lines
 * (`notes`: a rewritten `routes.json`, W1005, rfc:0055); `dev` hands the terminal to Vite.
 * Undefined when there is no Vite config. `deployable` sets `KEEL_DEPLOYABLE` for that run (k.server Build).
 */
export function viteRun(
  cwd: string,
  mode: "build" | "dev",
  deployable?: string,
): { code: number; tail: string; notes: string[] } | undefined {
  if (!existsSync(join(cwd, "vite.config.ts"))) return undefined;
  const args = mode === "build" ? ["--no-install", "vite", "build"] : ["--no-install", "vite"];
  const env = deployable === undefined ? process.env : { ...process.env, KEEL_DEPLOYABLE: deployable };
  const r = spawnSync("npx", args, { cwd, env, encoding: "utf8", stdio: mode === "build" ? "pipe" : "inherit" });
  const code = r.status ?? 1;
  const tail =
    code === 0 || mode === "dev" ? "" : `${(r.stderr || r.stdout || "").trim().split("\n").slice(-5).join("\n")}\n`;
  const notes = code === 0 && mode === "build" ? keelLines(`${r.stdout ?? ""}\n${r.stderr ?? ""}`) : [];
  return { code, tail, notes };
}
