// Shared helpers for the agent-files conformance (not a test file). Seed: none (examples; spawns are costly).
// Drives the real `keel` binary through keel-cli.ts on a materialized directory, as place-support.ts does.
// ASSUMED (k.docs "Forms"): `keel docs` lists skills after the sections as `docs.entry` records with package `@keel/cli`;
// a skill id is the entry whose id has no `.` (section ids are `k.router`, `std.tables`; skill names are `keel-client`).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { childOutput, cleanup, keel, materialize, readTree, type CliRecord } from "./keel-cli.ts";

export { cleanup, keel, materialize, readTree };
export type { CliRecord };
export const START = "<!-- keel:start -->";
export const END = "<!-- keel:end -->";

/** A fresh `keel scaffold project shop` in a temp dir; `proj` is the project folder. */
export function scaffolded(extra: string[] = []): { dir: string; proj: string } {
  const dir = materialize(new Map());
  const r = keel(dir, ["scaffold", "project", "shop", ...extra]);
  if (r.status !== 0) throw new Error(`scaffold project failed (status ${String(r.status)}): ${childOutput(r)}`);
  return { dir, proj: join(dir, "shop") };
}

/** A temp dir holding only these files (a project with a package.json is the least a project needs). */
export const projectWith = (files: Record<string, string>): string => materialize(new Map(Object.entries(files)));

export const PKG = `${JSON.stringify({ name: "app", version: "0.0.0", dependencies: { "@keel/cli": "*" } })}\n`;

export const skillIds = (proj: string): string[] =>
  keel(proj, ["docs"])
    .records.filter((r) => r.kind === "docs.entry" && typeof r.id === "string" && !r.id.includes("."))
    .map((r) => String(r.id));

export const skillPath = (name: string): string => `.claude/skills/${name}/SKILL.md`;

export const countLines = (text: string, marker: string): number => text.split("\n").filter((l) => l === marker).length;

/** The block, markers included. */
export function blockOf(agents: string): string {
  const a = agents.indexOf(START);
  const b = agents.indexOf(END);
  return a < 0 || b < 0 ? "" : agents.slice(a, b + END.length);
}

export const tokenCount = (s: string): number => Math.ceil(s.length / 4);

export const diffPaths = (a: Map<string, string>, b: Map<string, string>): string[] => {
  const out = new Set<string>();
  for (const [p, v] of a) if (b.get(p) !== v) out.add(p);
  for (const p of b.keys()) if (!a.has(p)) out.add(p);
  return [...out].sort();
};

/** Reads a file, "" when absent (a red run must fail on an assertion, not on a missing file). */
export const tryRead = (p: string): string => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
};
export const put = (p: string, text: string): void => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
};
export const drop = (p: string): void => rmSync(p, { force: true });
