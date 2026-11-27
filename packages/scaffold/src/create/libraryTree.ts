import type { Result } from "@keel/schema";
import { gitignoreOf } from "../internal/gitignoreOf.ts";
import { libraryFiles } from "../internal/libraryFiles.ts";
import { withAgents } from "../internal/withAgents.ts";
import type { AgentSkill } from "../types/AgentSkill.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";

/**
 * The tree of a new library (k.library-pack Scaffold, k.create Files), path -> text from the library's own folder,
 * the one `createPlan --library` and `keel scaffold library` both write: what `library` writes, then `.gitignore` and
 * the agent files with `skills` (the library's block). `@keel/*` stay at `^<version>`; `packageManager` and yarn's
 * `.yarnrc.yml` as an app's.
 */
export function libraryTree(input: {
  readonly name: string;
  readonly version: string;
  readonly skills: readonly AgentSkill[];
  readonly packageManager?: string | undefined;
}): Result<Map<string, string>, ScaffoldError> {
  const made = libraryFiles(input.name, input.version, input.packageManager);
  if (!made.ok) return made;
  const own = new Map(made.value.files);
  own.set(".gitignore", gitignoreOf(input.packageManager));
  if (input.packageManager?.startsWith("yarn@") === true) own.set(".yarnrc.yml", "nodeLinker: node-modules\n");
  return withAgents(own, input.skills);
}
