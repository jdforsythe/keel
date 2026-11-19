import type { SourceFile } from "../types/SourceFile.ts";
import { joinPath } from "./modules/joinPath.ts";

const SUFFIXES = ["", ".ts", ".tsx", "/index.ts"];

/** The project file a relative specifier in `from` names, or undefined (package specifiers included). */
export function importTarget(from: string, spec: string, project: readonly SourceFile[]): SourceFile | undefined {
  if (!spec.startsWith("./") && !spec.startsWith("../")) return undefined;
  const base = joinPath(from.slice(0, Math.max(0, from.lastIndexOf("/"))), spec);
  for (const suffix of SUFFIXES) {
    const hit = project.find((f) => f.path === `${base}${suffix}`);
    if (hit !== undefined) return hit;
  }
  return undefined;
}
