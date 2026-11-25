import path from "node:path";
import type { Resolve } from "@keel/compiler/internal";
import { relativeResolve } from "@keel/compiler/internal";
import type { SourceFile } from "../types/SourceFile.ts";
import { diskResolve } from "./diskResolve.ts";
import { projectRoots } from "./projectRoots.ts";

/**
 * The one way reach follows a specifier in the project folder `dir` of `project` (k.boundary Following), over
 * `known`, the folder's files relative to it: on disk under the project's root (`diskResolve`) when `check()` made
 * the array, else relative specifiers only.
 */
export function reachResolve(project: readonly SourceFile[], dir: string, known: ReadonlySet<string>): Resolve {
  const relative = relativeResolve(known);
  const root = projectRoots.get(project);
  return root === undefined ? relative : diskResolve(path.join(root, dir), known, relative);
}
