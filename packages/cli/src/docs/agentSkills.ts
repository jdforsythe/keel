import type { AgentSkill } from "@keel/scaffold/agents";
import type { SourceFile } from "../types/SourceFile.ts";
import { readDocs } from "./readDocs.ts";

/** The skills of the running `@keel/cli` in name order (k.docs Resolution), as the agent files copy them. */
export function agentSkills(files: readonly SourceFile[]): readonly AgentSkill[] {
  return readDocs(files).skills;
}
