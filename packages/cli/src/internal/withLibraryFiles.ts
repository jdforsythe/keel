import type { Edit } from "@keel/scaffold";
import { libraryTree } from "@keel/scaffold/create";
import type { Io } from "../types/Io.ts";
import { cliVersion } from "./cliVersion.ts";
import { projectFiles } from "./projectFiles.ts";

/**
 * A `scaffold library <name>` edit set with the files `create-app --library` adds in `<base>/` (k.explain Agent files):
 * `.gitignore` and the agent files of the running `@keel/cli`, the library's block among them; created paths sorted.
 */
export async function withLibraryFiles(edit: Edit, io: Io, name: string): Promise<Edit> {
  const { agentSkills } = await import("@keel/cli/docs");
  const tree = libraryTree({ name, version: cliVersion(), skills: agentSkills(projectFiles(io)) });
  const dir = edit.created[0]?.split("/")[0];
  if (!tree.ok || dir === undefined) return edit;
  const extra = new Map([...tree.value].map(([p, v]): [string, string] => [`${dir}/${p}`, v]));
  const files = new Map([...edit.files, ...extra]);
  const created = [...new Set([...edit.created, ...extra.keys()])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { ...edit, files, created };
}
