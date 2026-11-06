import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Binary only: bundle or serve with Vite when the project has `vite.config.ts`. `build` captures Vite's output
 * and returns its last lines only on failure (OUTPUT.md: success is silent); `dev` hands the terminal to Vite.
 * Undefined when there is no Vite config.
 */
export function viteRun(cwd: string, mode: "build" | "dev"): { code: number; tail: string } | undefined {
  if (!existsSync(join(cwd, "vite.config.ts"))) return undefined;
  const args = mode === "build" ? ["--no-install", "vite", "build"] : ["--no-install", "vite"];
  const r = spawnSync("npx", args, { cwd, encoding: "utf8", stdio: mode === "build" ? "pipe" : "inherit" });
  const code = r.status ?? 1;
  const tail =
    code === 0 || mode === "dev" ? "" : `${(r.stderr || r.stdout || "").trim().split("\n").slice(-5).join("\n")}\n`;
  return { code, tail };
}
