import { type Result, ok } from "@keel/schema";
import { agentFiles } from "../agents/agentFiles.ts";
import type { AgentSkill } from "../types/AgentSkill.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import { sortedKeys } from "./sortedKeys.ts";

/**
 * `tree` with its agent files (k.explain Agent files): `AGENTS.md` with the Keel block (the library's when its
 * `package.json` says `"keel": "library"`), `CLAUDE.md` and a copy of each skill, the skills in name order as
 * `keel docs` lists them; paths sorted.
 */
export function withAgents(
  tree: ReadonlyMap<string, string>,
  skills: readonly AgentSkill[],
): Result<Map<string, string>, ScaffoldError> {
  const ordered = [...skills].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const agents = agentFiles(tree, ordered);
  if (!agents.ok) return agents;
  const all = new Map(tree);
  for (const f of agents.value) if (f.want !== null) all.set(f.path, f.want);
  return ok(new Map(sortedKeys(all.keys()).map((p) => [p, all.get(p) ?? ""])));
}
