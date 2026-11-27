import type { Result } from "@keel/schema";
import { opProject } from "../internal/opProject.ts";
import { withAgents } from "../internal/withAgents.ts";
import type { AgentSkill } from "../types/AgentSkill.ts";
import type { ScaffoldError } from "../types/ScaffoldError.ts";

/**
 * The tree of a new app (k.create Files), path -> text, the one `createPlan` and `keel scaffold project` both write:
 * the generator `project` for the name, adapter and creating `version`, with `packageManager` (`<name>@<version>`,
 * none for none) unless it is a `member` of a workspace, then the agent files with `skills`.
 */
export function projectTree(input: {
  readonly name: string;
  readonly adapter: "client" | "node" | "static";
  readonly version: string;
  readonly packageManager: string | undefined;
  readonly member: boolean;
  readonly skills: readonly AgentSkill[];
}): Result<Map<string, string>, ScaffoldError> {
  const { name, adapter, version, packageManager, member, skills } = input;
  const made = opProject(
    { name, adapter, version, member, ...(packageManager === undefined ? {} : { packageManager }) },
    new Map(),
  );
  return made.ok ? withAgents(made.value.files, skills) : made;
}
