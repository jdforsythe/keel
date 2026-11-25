import { join } from "node:path";
import { projectDirs } from "@keel/compiler";
import { projectTokens } from "@keel/compiler/hosting/projectTokens";
import { clipMessage } from "@keel/schema/internal";
import type { SourceFile } from "../types/SourceFile.ts";
import type { CheckDiagnostic } from "./CheckDiagnostic.ts";

/**
 * The tokens every check of `project` reads (k.a11y-static Tokens): for each project directory of `project`
 * (`projectDirs`) whose `tokens.ts` is on disk under `cwd`, its `tokens` export as `check()`'s `projectArtifacts`;
 * a `tokens.ts` that gives none is one E1807 at its line 1, column 1, and that project gets no tokens.
 */
export async function checkTokens(
  cwd: string,
  project: readonly SourceFile[],
): Promise<{ projectArtifacts: Record<string, { tokens: unknown }>; diags: CheckDiagnostic[] }> {
  const projectArtifacts: Record<string, { tokens: unknown }> = {};
  const diags: CheckDiagnostic[] = [];
  const dirs = projectDirs(project.map((f) => ({ path: f.path, source: f.source })));
  const found = await Promise.all(dirs.map(async (dir) => [dir, await projectTokens(join(cwd, dir))] as const));
  for (const [dir, r] of found) {
    if (r === undefined) continue;
    if (r.ok) projectArtifacts[dir] = { tokens: r.tokens };
    else
      diags.push({
        code: "E1807",
        path: `${dir}tokens.ts`,
        line: 1,
        col: 1,
        message: clipMessage(r.reason, 89),
        see: "k.ui",
      });
  }
  return { projectArtifacts, diags };
}
