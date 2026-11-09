import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ActionIo } from "./ActionIo.ts";

/**
 * The process `ActionIo` for `keel-session-action`: the process env, the wall clock, the global `fetch`, files under
 * the cwd, and `run` spawning `KEEL_COMMAND` (default `pnpm exec keel`, split on spaces) with stdout captured and
 * stderr passed through.
 */
export function actionHost(): ActionIo {
  const cwd = process.cwd();
  const env = Object.fromEntries(
    Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  const words = (env.KEEL_COMMAND ?? "").split(/\s+/).filter((w) => w !== "");
  const [bin = "pnpm", ...pre] = words.length > 0 ? words : ["pnpm", "exec", "keel"];
  return {
    env,
    now: () => Date.now(),
    fetch: (url, init) => (init === undefined ? fetch(url) : fetch(url, init)),
    run: (args, childEnv) =>
      new Promise((resolve) => {
        const child = spawn(bin, [...pre, ...args], { cwd, env: childEnv, stdio: ["ignore", "pipe", "inherit"] });
        let out = "";
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          out += chunk;
        });
        child.on("error", () => resolve({ code: 127, stdout: out }));
        child.on("close", (code) => resolve({ code: code ?? 1, stdout: out }));
      }),
    read: (file) => {
      const abs = path.resolve(cwd, file);
      return existsSync(abs) ? readFileSync(abs, "utf8") : undefined;
    },
  };
}
