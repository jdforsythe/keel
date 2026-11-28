import type { Argument } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { followRef } from "./followRef.ts";

/** Whether `e` in `file` is the `@keel/schema` namespace: its `s` export or a namespace import of the package. */
export function isSchemaNamespace(e: Argument, file: SourceFile, project: readonly SourceFile[]): boolean {
  if (e.type === "SpreadElement") return false;
  const at = followRef(e, file, project);
  return (
    at !== null &&
    at !== "global" &&
    "package" in at &&
    at.package === "@keel/schema" &&
    (at.name === "s" || at.name === "*")
  );
}
