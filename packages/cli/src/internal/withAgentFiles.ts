import type { Edit } from "@keel/scaffold";
import { agentFiles } from "@keel/scaffold/agents";
import type { Io } from "../types/Io.ts";
import { projectFiles } from "./projectFiles.ts";

/**
 * A `scaffold project` edit set plus the agent files of the running `@keel/cli` (k.scaffold Agent files), their
 * commands in the form of the new `package.json`'s `packageManager`, created paths kept sorted. Loads `@keel/cli/docs`
 * only for this generator.
 */
export async function withAgentFiles(edit: Edit, io: Io): Promise<Edit> {
  const { agentSkills } = await import("@keel/cli/docs");
  const pkg = edit.files.get("package.json");
  const r = agentFiles(new Map(pkg === undefined ? [] : [["package.json", pkg]]), agentSkills(projectFiles(io)));
  const extra = new Map(
    r.ok ? r.value.flatMap((f): [string, string][] => (f.want === null ? [] : [[f.path, f.want]])) : [],
  );
  const files = new Map([...edit.files, ...extra]);
  const created = [...new Set([...edit.created, ...extra.keys()])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { ...edit, files, created };
}
