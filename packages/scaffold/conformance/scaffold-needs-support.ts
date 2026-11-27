// Shared by the k.scaffold-needs conformance (scaffold-needs.test.ts, library-rename-public-exports.test.ts). Not a test file.
// The projects are the ones the `create-app` bin writes (a child process, a minimal environment, `npm_config_user_agent` pnpm), written once per kind into a
// scratch folder from `mkdtemp` and copied per case; the `keel` binary runs over each copy in compact output (rfc0247-support.ts `keelCompact`).
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root } from "./keel-cli.ts";
import { argvOf, keelCompact } from "./rfc0247-support.ts";
import { BOUND } from "./shell-support.ts";

export { BOUND, argvOf, keelCompact };
export type Kind = "client" | "static" | "node" | "library";
export const APPS = ["client", "static", "node"] as const;
export type App = (typeof APPS)[number];

const BIN = join(root, "packages/create-app/src/bin.ts");
const made: string[] = [];
const templates = new Map<Kind, string>();

function scratch(): string {
  const d = mkdtempSync(join(tmpdir(), "keel-needs-"));
  made.push(d);
  return d;
}
/** Removes every scratch folder this file made. */
export function cleanAll(): void {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
}

const ARGS: Record<Kind, string[]> = {
  client: ["shop"],
  static: ["shop", "--adapter", "static"],
  node: ["shop", "--adapter", "node"],
  library: ["charts", "--library", "@acme/charts"],
};
const FOLDER: Record<Kind, string> = { client: "shop", static: "shop", node: "shop", library: "charts" };

/** The project `create-app` writes for `kind`, once; the returned folder is never run in. */
function template(kind: Kind): string {
  const have = templates.get(kind);
  if (have !== undefined) return have;
  const dir = scratch();
  const r = spawnSync(process.execPath, [BIN, ...ARGS[kind], "--format=compact"], {
    cwd: dir,
    encoding: "utf8",
    timeout: BOUND,
    env: {
      PATH: process.env.PATH ?? "",
      TMPDIR: process.env.TMPDIR ?? tmpdir(),
      npm_config_user_agent: "pnpm/9.12.0 node/v22.15.0",
    },
  });
  if (r.status !== 0)
    throw new Error(`create-app ${ARGS[kind].join(" ")} exited ${String(r.status)}: ${r.stdout}${r.stderr}`);
  const path = join(dir, FOLDER[kind]);
  templates.set(kind, path);
  return path;
}

/** `node_modules/@keel/*` and the external tools linked into `dir`, so the project's commands resolve what they import. */
function link(dir: string): void {
  mkdirSync(join(dir, "node_modules/@keel"), { recursive: true });
  for (const pkg of readdirSync(join(root, "packages")))
    symlinkSync(join(root, "packages", pkg), join(dir, "node_modules/@keel", pkg));
  for (const n of ["vitest", "vite", "typescript", "happy-dom", "fast-check"])
    symlinkSync(join(root, "node_modules", n), join(dir, "node_modules", n));
}

/** A fresh copy of the created project of `kind`, linked, in its own scratch folder. */
export function fresh(kind: Kind): string {
  const dir = join(scratch(), FOLDER[kind]);
  cpSync(template(kind), dir, { recursive: true });
  link(dir);
  return dir;
}

/** The `keel scaffold ...` lines an output holds: from `keel scaffold` to the end of its line. */
export function printedLines(out: string): string[] {
  return [...out.matchAll(/keel scaffold [^\n]*$/gm)].map((m) => m[0]);
}
/** Whether any line of `out` ends with `tail`. */
export const endsWithLine = (out: string, tail: string): boolean =>
  out.split("\n").some((l) => l.trimEnd().endsWith(tail));
/** An output naming no command to run: no `keel scaffold` and no `keel codemod`. */
export const holdsNoLine = (out: string): boolean => !/keel (scaffold|codemod)\b/.test(out);

/** Runs a printed line `keel <argv...>` as written in `dir`. */
export function runLine(dir: string, line: string): { status: number | null; out: string } {
  const argv = argvOf(line);
  if (argv[0] !== "keel") throw new Error(`not a keel line: ${line}`);
  const r = keelCompact(dir, argv.slice(1));
  return { status: r.status, out: r.stdout + r.stderr };
}
export function scaffold(dir: string, args: string[]): { status: number | null; out: string } {
  const r = keelCompact(dir, ["scaffold", ...args]);
  return { status: r.status, out: r.stdout + r.stderr };
}

/** The names of the deployables `topology.ts` declares: a key whose object holds an `adapter:` before any nested brace. */
export function deployables(topologyText: string): string[] {
  return [...topologyText.matchAll(/([A-Za-z_]\w*)\s*:\s*\{[^{}]*?\badapter\s*:/g)].map((m) => m[1] ?? "").sort();
}
