import type { Origins } from "@keel/compiler";
import type { SourceFile } from "../types/SourceFile.ts";
import type { shellTargets } from "./shellTargets.ts";

/**
 * `shellTargets` of the project at `cwd`, behind `@keel/cli/shell` (`@keel/cli` size budget), which imports a shell
 * package only for a shell `shellsOf` lists; for none, no target and no diagnostic.
 */
export async function loadShells(
  cwd: string,
  project: readonly SourceFile[],
  policy: ((origins?: Origins) => string) | undefined,
): Promise<Awaited<ReturnType<typeof shellTargets>>> {
  return (await import("@keel/cli/shell")).shellTargets(cwd, project, policy);
}
