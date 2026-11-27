import { join } from "node:path";
import { projectDirs } from "@keel/compiler";
import type { TokensResult } from "@keel/compiler/hosting/TokensResult";
import { projectTokens } from "@keel/compiler/hosting/projectTokens";
import { clipMessage } from "@keel/schema/internal";
import type { SourceFile } from "../types/SourceFile.ts";
import type { CheckDiagnostic } from "./CheckDiagnostic.ts";
import { fitTokenMessage } from "./fitTokenMessage.ts";
import { tokenKeyAt } from "./tokenKeyAt.ts";
import { tokenSee } from "./tokenSee.ts";

const THROWS = "tokens.ts throws: ";

/** The E1807 of a `tokens.ts` that gives no tokens, at `path` (k.themes Token errors). */
function refusal(path: string, source: string | undefined, r: Extract<TokensResult, { ok: false }>): CheckDiagnostic {
  if (r.path !== undefined) {
    const lead = `${r.path.join(".")}: `;
    const what = r.reason.startsWith(lead) ? r.reason.slice(lead.length) : r.reason;
    const at = source === undefined ? { line: 1, col: 1 } : tokenKeyAt(source, r.path);
    return { code: "E1807", path, ...at, message: fitTokenMessage(r.path, what), see: tokenSee(what) };
  }
  const message = r.reason.startsWith(THROWS)
    ? `${THROWS}${clipMessage(r.reason.slice(THROWS.length).split("\n")[0] ?? "", 60)}`
    : clipMessage(r.reason, 89);
  return { code: "E1807", path, line: 1, col: 1, message, see: "k.a11y-static" };
}

/**
 * The tokens every check of `project` reads (k.a11y-static Tokens): for each project directory of `project`
 * (`projectDirs`) whose `tokens.ts` is on disk under `cwd`, its `tokens` export as `check()`'s `projectArtifacts`;
 * a `tokens.ts` that gives none is one E1807, at the key the refused path names or at line 1, column 1, and that
 * project gets no tokens.
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
    const path = `${dir}tokens.ts`;
    if (r.ok) projectArtifacts[dir] = { tokens: r.tokens };
    else diags.push(refusal(path, project.find((f) => f.path === path)?.source, r));
  }
  return { projectArtifacts, diags };
}
