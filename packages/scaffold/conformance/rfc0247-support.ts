// Shared by the RFC 0247 second-review conformance files (route loader note, E1052 example lines). Not a test file.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { type Files, apply } from "./fixtures.ts";
import { root } from "./keel-cli.ts";
import { BOUND } from "./shell-support.ts";

export type Plain = { status: number | null; stdout: string; stderr: string };

/** The default (`client`) project alone: module `app` and nothing else. */
export function clientProject(): Files {
  return apply("project", { name: "shop" }, new Map()).files;
}
/** The `node` project alone: module `app` on a `node` deployable. */
export function nodeProject(): Files {
  return apply("project", { name: "shop", adapter: "node" }, new Map()).files;
}

/**
 * The environment of the test run, less vitest's own keys and `npm_config_user_agent`: run as a reader types `keel`,
 * so its lines take the bare form (k.cli Command form), whether or not a package manager started the test run.
 */
function cleanEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST" || k === "npm_config_user_agent") continue;
    env[k] = v;
  }
  return env;
}

/** The real `keel` binary over `dir` in compact output (`--format=compact`), the argv as typed. */
export function keelCompact(dir: string, args: string[]): Plain {
  const r = spawnSync(process.execPath, [join(root, "packages/cli/src/bin.ts"), ...args, "--format=compact"], {
    cwd: dir,
    encoding: "utf8",
    env: cleanEnv(),
    timeout: BOUND,
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Splits a printed `keel scaffold ...` line into the argv after `keel`, honouring single and double quotes. */
export function argvOf(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote = "";
  let has = false;
  for (const ch of line) {
    if (quote !== "") {
      if (ch === quote) quote = "";
      else cur += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || cur !== "") out.push(cur);
      cur = "";
      has = false;
    } else cur += ch;
  }
  if (has || cur !== "") out.push(cur);
  return out;
}

/** The line `keel scaffold <op> ...` an output holds (the rest of its line), or undefined. */
export function exampleLine(output: string, op: string): string | undefined {
  const m = new RegExp(`keel scaffold ${op}(?: [^\\n]*)?$`, "m").exec(output);
  return m?.[0];
}
