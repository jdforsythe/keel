import type { Edit } from "@keel/scaffold";
import type { Io } from "../types/Io.ts";
import { projectFiles } from "./projectFiles.ts";

/**
 * A `scaffold project` edit set plus the agent files of the running `@keel/cli` (k.scaffold Agent files), created
 * paths kept sorted. Loads `@keel/cli/docs` only for this generator.
 */
export async function withAgentFiles(edit: Edit, io: Io): Promise<Edit> {
  const { agentWrites } = await import("@keel/cli/docs");
  const extra = agentWrites(projectFiles(io));
  const files = new Map([...edit.files, ...extra]);
  const created = [...new Set([...edit.created, ...extra.keys()])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { ...edit, files, created };
}
