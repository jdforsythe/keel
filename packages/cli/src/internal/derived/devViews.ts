import { isAbsolute, join } from "node:path";
import type { SourceFile } from "../../types/SourceFile.ts";
import { CODE_FILE } from "../CODE_FILE.ts";
import type { Diag } from "../Diag.ts";
import { deployFreshness } from "../deployFreshness.ts";
import { evaluationDiag } from "../evaluationDiag.ts";
import { libraryManifestFiles } from "../libraryManifestFiles.ts";
import { loadShells } from "../loadShells.ts";
import { readProject } from "../readProject.ts";
import { relPath } from "../relPath.ts";
import { shellPolicy } from "../shellPolicy.ts";
import { viewDirs } from "../viewDirs.ts";
import type { View } from "./View.ts";
import type { Work } from "./Work.ts";
import { deriveEvaluated } from "./deriveEvaluated.ts";
import { refreshViews } from "./refreshViews.ts";

/**
 * One refresh of `keel dev` over the project at `cwd` (k.derived Refresh): each project's evaluated views
 * (`routes.json`, `surface.json`; `deriveEvaluated`, cached) and its deploy files (`deployFreshness`), each written
 * when its bytes differ (`refreshViews`; W1018 when one cannot be written). The compiled views are the Vite plugin's.
 * Returns the evaluations' problems (as `keel check` reports them), the W1018 records, `files`, the inputs of every
 * derivation it took, which the dev server watches (a change to one, or to the code file paths, is the next refresh's
 * cause), and `routes`, the root project's `routes.json` entries (`null`: its evaluation failed; undefined: it has no
 * views). An aborted `signal` ends its evaluation and
 * rejects, writing nothing.
 */
export async function devViews(
  cwd: string,
  signal?: AbortSignal,
): Promise<{ diags: Diag[]; files: string[]; routes: Readonly<Record<string, unknown>> | null | undefined }> {
  const project: SourceFile[] = readProject(cwd, "query");
  const dirs = viewDirs(project);
  const work: Work = { evaluated: 0, cached: 0, refreshed: 0 };
  const files: string[] = [];
  const views: View[] = [];
  const holds: (() => boolean)[] = [];
  const problems: Diag[] = [];
  let routes: Readonly<Record<string, unknown>> | null | undefined;
  for (const dir of dirs) {
    const own = project.filter(
      (f) => f.path.startsWith(dir) && !dirs.some((d) => d.length > dir.length && f.path.startsWith(d)),
    );
    const rel = own.map((f) => ({ path: f.path.slice(dir.length), source: f.source }));
    const codes = rel.filter((f) => CODE_FILE.test(f.path)).map((f) => f.path);
    const ev = await deriveEvaluated(join(cwd, dir), rel, codes, work, signal);
    files.push(...ev.files);
    holds.push(ev.held);
    // Each problem is printed as `keel check` prints it (k.evaluator Placing), and its project's views stay.
    for (const line of ev.problems) {
      const d = evaluationDiag(line);
      const at = d.path === undefined || isAbsolute(d.path) ? d.path : `${dir}${d.path}`;
      problems.push(at === undefined ? d : { ...d, path: isAbsolute(at) ? relPath(cwd, at) : at });
    }
    if (dir === "") routes = ev.problems.length > 0 ? null : ev.entries;
    if (ev.problems.length > 0) continue;
    views.push({ path: `${dir}.keel/routes.json`, text: ev.routes, readonly: true });
    views.push({ path: `${dir}.keel/surface.json`, text: ev.surface, readonly: true });
  }
  const policy = await shellPolicy(cwd, project);
  const loaded = await loadShells(cwd, project, policy);
  const deploy = deployFreshness([...project, ...libraryManifestFiles(cwd, project)], policy, loaded.shells, false);
  views.push(...deploy.views);
  if (signal?.aborted === true) throw signal.reason;
  const diags = [...problems, ...refreshViews(cwd, views, () => holds.every((h) => h()), work)];
  return { diags, files, routes };
}
