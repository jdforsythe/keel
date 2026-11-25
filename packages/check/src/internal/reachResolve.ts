import path from "node:path";
import type { Resolve } from "@keel/compiler/internal";
import { relativeResolve } from "@keel/compiler/internal";
import type { SourceFile } from "../types/SourceFile.ts";
import { diskResolve } from "./diskResolve.ts";
import { libraryEntriesUnder } from "./libraryEntriesUnder.ts";
import { projectRoots } from "./projectRoots.ts";

/**
 * The one way reach follows a specifier in the project folder `dir` of `project` (k.boundary Following), over
 * `known`, the folder's files relative to it: a listed library's `exports` entry (`libraryEntriesUnder`, k.library In
 * an app) to the file it gives when that file is known, else on disk under the project's root (`diskResolve`, which
 * follows nothing into `node_modules/`) when `check()` made the array, else relative specifiers only. A library's files
 * are known at `modules/<id>/<f>`, so their relative imports are followed as a module's are.
 */
export function reachResolve(project: readonly SourceFile[], dir: string, known: ReadonlySet<string>): Resolve {
  const relative = relativeResolve(known);
  const root = projectRoots.get(project);
  const inner = root === undefined ? relative : diskResolve(path.join(root, dir), known, relative);
  const entries = libraryEntriesUnder(dir, project);
  if (Object.keys(entries).length === 0) return inner;
  return (from, specifier) => {
    const spec = specifier.split("?")[0] ?? specifier;
    const entry = Object.hasOwn(entries, spec) ? entries[spec] : undefined;
    return entry !== undefined && known.has(entry) ? entry : inner(from, specifier);
  };
}
