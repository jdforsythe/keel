import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { keelLines } from "./keelLines.ts";
import { toolCommand } from "./toolCommand.ts";

/** A line of a thrown error's printout that is not its message: a stack frame, an unread property, the closing brace, a blank. */
const FRAME = /^\s+at |Getter\/S|^}|^\s*$/;

/**
 * Binary only: `vite build` (the project's Vite by its real path, `toolCommand`) when the project has `vite.config.ts`. Vite's output is captured: on
 * failure the message lines of its stderr (stdout when stderr is empty) are returned, the bundler's own errors among
 * them (`<file>:<line>:<col>: ERROR: Could not resolve "<specifier>"`, a Keel-coded E1007): stack frames are dropped
 * and the last 12 lines kept under a count of the lines before them (`... +3 more`); on success (OUTPUT.md: success
 * is silent). Its Keel-coded lines are `notes`, on success and on failure: an evaluation problem that failed the build
 * (E1006, E1807, E1819); a failure that holds a Keel-coded error returns no message lines, the record standing for
 * them. Undefined when there is no Vite config. Vite runs with `NODE_ENV=production`
 * whatever the shell or a project `.env` sets, so the client is the production one (k.deploy Build); `deployable` sets
 * `KEEL_DEPLOYABLE` for that run (k.server Build); `frozen` sets `KEEL_FROZEN=1`, so the Vite plugin writes no view
 * (k.derived Frozen).
 */
export function viteRun(
  cwd: string,
  deployable?: string,
  frozen = false,
): { code: number; tail: string; notes: string[] } | undefined {
  if (!existsSync(join(cwd, "vite.config.ts"))) return undefined;
  const base = { ...process.env, NODE_ENV: "production", ...(frozen ? { KEEL_FROZEN: "1" } : {}) };
  const env = deployable === undefined ? base : { ...base, KEEL_DEPLOYABLE: deployable };
  const tool = toolCommand(cwd, "vite", "vite", ["build"]);
  const r = spawnSync(tool.cmd, tool.args, { cwd, env, encoding: "utf8", stdio: "pipe" });
  const code = r.status ?? 1;
  const lines = (r.stderr || r.stdout || "").split("\n").filter((l) => !FRAME.test(l));
  const more = lines.length - 12;
  const notes = keelLines(`${r.stdout ?? ""}\n${r.stderr ?? ""}`);
  // A failure a Keel-coded error explains is that record alone; Vite's printout of the throw adds nothing to it.
  const explained = notes.some((n) => /^E\d{4} /.test(n));
  const tail =
    code === 0 || explained ? "" : `${more > 0 ? `... +${more} more\n` : ""}${lines.slice(-12).join("\n").trim()}\n`;
  return { code, tail, notes };
}
