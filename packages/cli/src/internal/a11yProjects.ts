import type { SourceFile } from "../types/SourceFile.ts";
import type { A11yProject } from "./A11yProject.ts";
import { routeEntries } from "./routeEntries.ts";

const ROUTES = ".keel/routes.json";

/** Every project under the run's directory, found by its `.keel/routes.json` (k.a11y Claims), in path order. */
export function a11yProjects(files: readonly SourceFile[]): A11yProject[] {
  return files
    .filter((f) => f.path === ROUTES || f.path.endsWith(`/${ROUTES}`))
    .map((f) => {
      const dir = f.path.slice(0, f.path.length - ROUTES.length);
      return { project: dir === "" ? "." : dir.slice(0, -1), dir, entries: routeEntries(f.source) };
    });
}
