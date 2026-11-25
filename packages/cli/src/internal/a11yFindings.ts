import { check } from "@keel/check";
import type { SourceFile } from "../types/SourceFile.ts";
import { CODE_FILE } from "./CODE_FILE.ts";
import { TEST_FILE } from "./TEST_FILE.ts";
import { checkTokens } from "./checkTokens.ts";
import { projectTopology } from "./projectTopology.ts";
import { relPath } from "./relPath.ts";

/** The static codes that carry a11y criteria (k.a11y Claims): E1802, E1804, E1820. */
const STATIC = new Set(["E1802", "E1804", "E1820"]);
const ROUTES = /(?:^|\/)\.keel\/routes\.json$/;

/**
 * The static a11y findings of every project with `.keel/routes.json`: the k.check pipeline (`check`, the rules
 * `keel check` runs, without its type pass) over each project's `modules/` code, tests aside, keeping E1802, E1804
 * and E1820 by code and project-relative path, each project given its `tokens.ts` as `keel check` gives it
 * (`checkTokens`).
 */
export async function a11yFindings(
  cwd: string,
  files: readonly SourceFile[],
): Promise<{ code: string; path: string }[]> {
  const dirs = files.filter((f) => ROUTES.test(f.path)).map((f) => f.path.slice(0, -".keel/routes.json".length));
  if (dirs.length === 0) return [];
  const code = files.filter(
    (f) => CODE_FILE.test(f.path) && !TEST_FILE.test(f.path) && dirs.some((d) => f.path.startsWith(`${d}modules/`)),
  );
  if (code.length === 0) return [];
  const topology = projectTopology(files);
  const { projectArtifacts } = await checkTokens(cwd, files);
  const r = check(code, {
    root: cwd,
    project: files,
    projectArtifacts,
    ...(topology === undefined ? {} : { topology }),
  });
  return r.diagnostics.flatMap((d) =>
    STATIC.has(d.code) && d.path !== undefined ? [{ code: d.code, path: relPath(cwd, d.path) }] : [],
  );
}
