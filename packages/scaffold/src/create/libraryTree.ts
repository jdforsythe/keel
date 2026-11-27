import { scaffold } from "@keel/scaffold";
import type { Result } from "@keel/schema";
import { GITIGNORE } from "../internal/GITIGNORE.ts";
import { withAgents } from "../internal/withAgents.ts";
import type { AgentSkill } from "../types/AgentSkill.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";

/**
 * The tree of a new library (k.library-pack Scaffold, k.create Files), path -> text from the library's own folder,
 * the one `createPlan --library` and `keel scaffold library` both write: what `library` writes, then `.gitignore` and
 * the agent files with `skills` (the library's block). `@keel/*` stay at `^<version>`.
 */
export function libraryTree(input: {
  readonly name: string;
  readonly version: string;
  readonly skills: readonly AgentSkill[];
}): Result<Map<string, string>, ScaffoldError> {
  const made = scaffold("library", { name: input.name, version: input.version }, new Map());
  if (!made.ok) return made;
  const dir = made.value.created[0]?.split("/")[0] ?? "";
  const own = new Map([...made.value.files].map(([p, v]): [string, string] => [p.slice(dir.length + 1), v]));
  own.set(".gitignore", GITIGNORE);
  return withAgents(own, input.skills);
}
