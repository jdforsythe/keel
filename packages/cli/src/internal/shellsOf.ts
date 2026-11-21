import { shellDeployables } from "@keel/scaffold";
import type { SourceFile } from "../types/SourceFile.ts";

const SHELLS = ["capacitor", "tauri"] as const;
/** A file of a shell folder, `deploy/<name>/<shell>/<path>`. */
const FOLDER = /^deploy\/[^/]+\/(capacitor|tauri)\/./;

/**
 * The shells whose package `keel check` and `keel build` load for `project` (k.shell Shell target), in order: each
 * with the `client` deployables of the root `topology.ts` that declare it. A shell no deployable declares is listed,
 * with none, only while a `deploy/<name>/<shell>/` folder holds a file, so that removing a shell removes its files
 * (k.shell Files). A name in other text or another path loads nothing.
 */
export function shellsOf(
  project: readonly SourceFile[],
): { readonly shell: (typeof SHELLS)[number]; readonly declared: readonly string[] }[] {
  const src = project.find((f) => f.path === "topology.ts")?.source ?? "";
  const folders = new Set(project.map((f) => FOLDER.exec(f.path)?.[1]));
  return SHELLS.map((shell) => ({ shell, declared: shellDeployables(src, shell) })).filter(
    (s) => s.declared.length > 0 || folders.has(s.shell),
  );
}
