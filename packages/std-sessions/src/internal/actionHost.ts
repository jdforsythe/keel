import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ActionIo } from "./ActionIo.ts";
import { clean } from "./clean.ts";

/**
 * The process `ActionIo` for `keel-session-action`: argv flags, the process env, the wall clock, the global `fetch`,
 * files under the cwd only, and `run` spawning `KEEL_COMMAND` (default `pnpm exec keel`, split on spaces) with stdout
 * captured. The child's stderr goes to stderr line by line, each line sanitized and prefixed `keel: `, so it cannot
 * start a workflow command.
 */
export function actionHost(): ActionIo {
  const cwd = process.cwd();
  const env = Object.fromEntries(
    Object.entries(process.env).flatMap(([k, v]): [string, string][] => (typeof v === "string" ? [[k, v]] : [])),
  );
  const words = (env.KEEL_COMMAND ?? "").split(/\s+/).filter((w) => w !== "");
  const [bin = "pnpm", ...pre] = words.length > 0 ? words : ["pnpm", "exec", "keel"];
  return {
    args: process.argv.slice(2),
    tty: process.stdout.isTTY === true,
    env,
    now: () => Date.now(),
    fetch: (url, init) => (init === undefined ? fetch(url) : fetch(url, init)),
    run: (args, childEnv) =>
      new Promise((resolve) => {
        const child = spawn(bin, [...pre, ...args], { cwd, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        let err = "";
        const flush = (all: boolean): void => {
          const lines = err.split("\n");
          err = all ? "" : (lines.pop() ?? "");
          for (const l of lines) if (l.trim() !== "") process.stderr.write(`keel: ${clean(l, 300)}\n`);
        };
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          out += chunk;
        });
        child.stderr.on("data", (chunk: string) => {
          err += chunk;
          flush(false);
        });
        child.on("error", () => resolve({ code: 127, stdout: out }));
        child.on("close", (code) => {
          flush(true);
          resolve({ code: code ?? 1, stdout: out });
        });
      }),
    read: (file) => {
      const abs = path.resolve(cwd, file);
      if (!abs.startsWith(cwd + path.sep)) return undefined;
      return existsSync(abs) ? readFileSync(abs, "utf8") : undefined;
    },
  };
}
