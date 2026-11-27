import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compiledViews } from "@keel/check";
import type { SourceFile } from "../../types/SourceFile.ts";
import { CODE_FILE } from "../CODE_FILE.ts";
import type { Diag } from "../Diag.ts";
import { checkInputs } from "../checkInputs.ts";
import { projectTopology } from "../projectTopology.ts";
import type { View } from "./View.ts";
import type { Work } from "./Work.ts";
import { deriveEvaluated } from "./deriveEvaluated.ts";
import { refreshViews } from "./refreshViews.ts";

const readText = (file: string): string | undefined => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
};

/**
 * What `keel test` takes of the derivation of the root project at `cwd` (k.derived Readers, Refresh): the bytes of
 * its compiled `a11y.json` (`compiledViews` over the project and its libraries' files), which each test process is
 * handed, and, not frozen, the views written: each compiled view and the evaluated `routes.json` and `surface.json`
 * whose bytes differ (`refreshViews`; W1018 for one that cannot be written), in a project with a `topology.ts` or a
 * view present. `schemes.json` is left to `keel check`,
 * which evaluates the tokens.
 */
export async function testViews(
  cwd: string,
  project: readonly SourceFile[],
  frozen: boolean,
  work: Work,
): Promise<{ a11y: string | undefined; diags: Diag[] }> {
  const { all } = checkInputs(cwd, project, project, false);
  const topology = projectTopology(project);
  const compiled = compiledViews("", all, topology === undefined ? {} : { topology });
  const a11y = compiled["a11y.json"] ?? undefined;
  // A project keeps views when it has a `topology.ts` or holds one already (k.derived Refresh).
  const keeps = project.some((f) => f.path === "topology.ts" || /^\.keel\/[^/]+\.json$/.test(f.path));
  if (frozen || !keeps) return { a11y, diags: [] };
  const views: View[] = [];
  for (const [name, text] of Object.entries(compiled))
    if (typeof text === "string" && name !== "routes.json") views.push({ path: `.keel/${name}`, text, readonly: true });
  const codes = project.filter((f) => CODE_FILE.test(f.path));
  const ev = await deriveEvaluated(
    cwd,
    project,
    codes.map((f) => f.path),
    work,
  );
  if (ev.problems.length === 0) {
    views.push({ path: ".keel/routes.json", text: ev.routes, readonly: true });
    views.push({ path: ".keel/surface.json", text: ev.surface, readonly: true });
  }
  const held = (): boolean => ev.held() && codes.every((f) => readText(join(cwd, f.path)) === f.source);
  return { a11y, diags: refreshViews(cwd, views, held, work) };
}
