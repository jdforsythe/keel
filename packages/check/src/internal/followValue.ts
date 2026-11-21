import type { Expression } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Followed } from "./Followed.ts";
import { followRef } from "./followRef.ts";

/**
 * `expr` in `file` followed to the expression it names, as `followRef` follows it; a binding from a package is
 * `"package"`, a name the file never declares `"global"`, anything else it cannot follow `null`.
 */
export function followValue(expr: Expression, file: SourceFile, project: readonly SourceFile[]): Followed {
  const at = followRef(expr, file, project);
  return at !== null && typeof at === "object" && "package" in at ? "package" : at;
}
