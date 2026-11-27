import { join } from "node:path";
import type { SourceFile } from "../../types/SourceFile.ts";
import { CODE_FILE } from "../CODE_FILE.ts";
import type { Diag } from "../Diag.ts";
import { deployFreshness } from "../deployFreshness.ts";
import { libraryManifestFiles } from "../libraryManifestFiles.ts";
import { loadShells } from "../loadShells.ts";
import { readProject } from "../readProject.ts";
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
 * Returns the W1018 records and `files`, the inputs of every derivation it took, which the dev server watches: a
 * change to one, or to the code file paths, is the next refresh's cause.
 */
export async function devViews(cwd: string): Promise<{ diags: Diag[]; files: string[] }> {
  const project: SourceFile[] = readProject(cwd, "query");
  const dirs = viewDirs(project);
  const work: Work = { evaluated: 0, cached: 0, refreshed: 0 };
  const files: string[] = [];
  const views: View[] = [];
  const holds: (() => boolean)[] = [];
  for (const dir of dirs) {
    const own = project.filter(
      (f) => f.path.startsWith(dir) && !dirs.some((d) => d.length > dir.length && f.path.startsWith(d)),
    );
    const rel = own.map((f) => ({ path: f.path.slice(dir.length), source: f.source }));
    const codes = rel.filter((f) => CODE_FILE.test(f.path)).map((f) => f.path);
    const ev = await deriveEvaluated(join(cwd, dir), rel, codes, work);
    files.push(...ev.files);
    holds.push(ev.held);
    if (ev.problems.length > 0) continue;
    views.push({ path: `${dir}.keel/routes.json`, text: ev.routes, readonly: true });
    views.push({ path: `${dir}.keel/surface.json`, text: ev.surface, readonly: true });
  }
  const policy = await shellPolicy(cwd, project);
  const loaded = await loadShells(cwd, project, policy);
  const deploy = deployFreshness([...project, ...libraryManifestFiles(cwd, project)], policy, loaded.shells, false);
  views.push(...deploy.views);
  const diags = refreshViews(cwd, views, () => holds.every((h) => h()), work);
  return { diags, files };
}
