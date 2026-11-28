import { projectDirs } from "@keel/compiler";
import { relativeResolve } from "@keel/compiler/internal";
import type { SourceFile } from "../types/SourceFile.ts";
import { dirPrograms } from "./dirPrograms.ts";
import { projectLibraries } from "./projectLibraries.ts";
import { valueImportSites } from "./valueImportSites.ts";

const families = new WeakMap<readonly SourceFile[], ReadonlySet<string>>();
const SHIPPED = /^((?:.*\/)?)src\/([a-z][A-Za-z0-9]*)Tokens\.ts$/;

/**
 * Whether `path` is a library's `src/<id>Tokens.ts` (k.looks): a listed library's file at `modules/<id>/`, or in a
 * folder that is no module's whose `module.ts` names `<id>` (the library's own folder).
 */
function isShipped(path: string, project: readonly SourceFile[]): boolean {
  const m = SHIPPED.exec(path);
  if (m === null) return false;
  // A listed library's files are viewed at `modules/<id>/` (k.library In an app).
  if (projectLibraries.get(project)?.files.has(path) === true) return (m[1] ?? "").endsWith(`modules/${m[2] ?? ""}/`);
  if (/(?:^|\/)modules\//.test(m[1] ?? "")) return false;
  const manifest = project.find((f) => f.path === `${m[1] ?? ""}module.ts`)?.source;
  return manifest !== undefined && new RegExp(`\\bid["']?\\s*:\\s*["']${m[2] ?? ""}["']`).test(manifest);
}

/**
 * The files whose tokens imports are free while no client entry reaches them (k.check-time Entries): each
 * project root's `tokens.ts` and every file it imports by relative value imports, transitively, and a library's
 * `src/<id>Tokens.ts` (k.looks).
 */
export function tokensFamily(path: string, project: readonly SourceFile[]): boolean {
  if (isShipped(path, project)) return true;
  let family = families.get(project);
  if (family === undefined) {
    const out = new Set<string>();
    for (const dir of projectDirs(project.map((f) => ({ path: f.path, source: f.source })))) {
      if (!project.some((f) => f.path === `${dir}tokens.ts`)) continue;
      const files = dirPrograms(dir, project);
      const byPath = new Map(files.map((f) => [f.path, f.program]));
      const resolve = relativeResolve(new Set(byPath.keys()));
      const queue = ["tokens.ts"];
      for (let i = 0; i < queue.length; i++) {
        const at = queue[i] ?? "";
        if (out.has(`${dir}${at}`)) continue;
        out.add(`${dir}${at}`);
        const program = byPath.get(at);
        for (const s of program === undefined ? [] : valueImportSites(program)) {
          const next = resolve(at, s.spec);
          if (next !== undefined) queue.push(next);
        }
      }
    }
    family = out;
    families.set(project, family);
  }
  return family.has(path);
}
