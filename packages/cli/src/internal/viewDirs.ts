import { VIEW } from "./VIEW.ts";

const TOPOLOGY = /^((?:.*\/)?)topology\.ts$/;

/**
 * The projects whose views a run over the disk keeps (k.derived Refresh): each dir with a `topology.ts` or a view
 * already present, outside `modules/` and `node_modules/`; none in a library's own folder.
 */
export function viewDirs(project: readonly { path: string }[]): string[] {
  const dirs = new Set<string>();
  for (const f of project) {
    const dir = TOPOLOGY.exec(f.path)?.[1] ?? VIEW.exec(f.path)?.[1];
    if (dir !== undefined && !dir.split("/").some((s) => s === "modules" || s === "node_modules")) dirs.add(dir);
  }
  return [...dirs].sort();
}
