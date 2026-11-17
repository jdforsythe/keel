import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { keelLines } from "./keelLines.ts";
import { toolCommand } from "./toolCommand.ts";

/**
 * Binary only: `vite build` (the project's Vite by its real path, `toolCommand`) when the project has `vite.config.ts`. Vite's output is captured: its last lines are
 * returned only on failure (OUTPUT.md: success is silent), and on success its Keel-coded lines (`notes`, such as a
 * rewritten `routes.json`, W1005). Undefined when there is no Vite config. Vite runs with `NODE_ENV=production`
 * whatever the shell or a project `.env` sets, so the client is the production one (k.deploy Build); `deployable` sets
 * `KEEL_DEPLOYABLE` for that run (k.server Build).
 */
export function viteRun(cwd: string, deployable?: string): { code: number; tail: string; notes: string[] } | undefined {
  if (!existsSync(join(cwd, "vite.config.ts"))) return undefined;
  const base = { ...process.env, NODE_ENV: "production" };
  const env = deployable === undefined ? base : { ...base, KEEL_DEPLOYABLE: deployable };
  const tool = toolCommand(cwd, "vite", "vite", ["build"]);
  const r = spawnSync(tool.cmd, tool.args, { cwd, env, encoding: "utf8", stdio: "pipe" });
  const code = r.status ?? 1;
  const tail = code === 0 ? "" : `${(r.stderr || r.stdout || "").trim().split("\n").slice(-5).join("\n")}\n`;
  const notes = code === 0 ? keelLines(`${r.stdout ?? ""}\n${r.stderr ?? ""}`) : [];
  return { code, tail, notes };
}
