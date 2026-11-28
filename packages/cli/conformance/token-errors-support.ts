// Shared helpers for the E1807 and E1818 conformance files of RFC 0249's review (not a test file): the real `keel` binary over a temp project.
// ASSUMED (spec names no fixture layout): a project of one `node` module `m` holding a view `V.tsx`, a `tokens.ts` and the files a case adds. A `@@` in a source marks the position a diagnostic is expected at (the character after it) and is removed before the file is written.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { TOPOLOGY, keelProject } from "./a11y-project-support.ts";
import { type CliRecord, type Run, keel, removeProject, root } from "./test-sim-project.ts";

export const SEED = 1337;
export const MODULE = `import { module } from "@keel/compiler";\nexport default module({ id: "m", deps: [], capabilities: [], public: { exports: [] } });\n`;
export const VIEW = `import { Text } from "@keel/ui";\nexport const V = () => <Text>x</Text>;\n`;

export type Marked = { source: string; line: number; col: number };
/** `source` without its `@@` marker, and the 1-based line and column the marker stood at. */
export function marked(source: string): Marked {
  const at = source.indexOf("@@");
  if (at < 0) throw new Error("fixture: no @@ marker");
  const before = source.slice(0, at);
  return {
    source: source.slice(0, at) + source.slice(at + 2),
    line: before.split("\n").length,
    col: at - before.lastIndexOf("\n"),
  };
}

const made: string[] = [];
export const cleanProjects = (): void => {
  for (const d of made.splice(0)) removeProject(d);
};

/** A project with `tokens` as its `tokens.ts` and `extra` beside it. */
export function project(prefix: string, tokens: string, extra: Readonly<Record<string, string>> = {}): string {
  const dir = keelProject(prefix, {
    "topology.ts": TOPOLOGY,
    "modules/m/module.ts": MODULE,
    "modules/m/V.tsx": VIEW,
    "tokens.ts": tokens,
    ...extra,
  });
  made.push(dir);
  return dir;
}

export const diagsOf = (run: Run, code: string): CliRecord[] =>
  run.records.filter((r) => r.kind === "diag" && r.code === code);

/** `keel check --format=compact` in `dir`: its stdout lines. */
export function compact(dir: string): string[] {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "NODE_ENV") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [join(root, "packages", "cli", "src", "bin.ts"), "check", "--format=compact"], {
    cwd: dir,
    encoding: "utf8",
    env,
  });
  return r.stdout.split("\n").filter((l) => l.trim() !== "");
}

export { keel };
