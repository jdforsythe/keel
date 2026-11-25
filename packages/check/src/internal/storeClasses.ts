import type { Argument } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { SchemaQuestion } from "./SchemaQuestion.ts";
import { schemaRead } from "./schemaRead.ts";

/**
 * The `.pii(class)` classes a store's state schema `expr` of `file` holds (k.leave E1107), read by `schemaRead`;
 * `undefined` when a part cannot be read (`'unknown'`, k.privacy-reads), or a `.pii()` names its class other than by a
 * string literal. A package's schema holds none the app must list.
 */
export function storeClasses(
  expr: Argument,
  file: SourceFile,
  project: readonly SourceFile[],
): ReadonlySet<string> | undefined {
  const classes = new Set<string>();
  const q: SchemaQuestion = {
    pkg: () => "no",
    global: "no",
    call: (e, _at, read) => {
      const c = e.callee;
      if (c.type !== "MemberExpression" || c.computed || c.property.name !== "pii") return undefined;
      const k = e.arguments[0];
      const inner = read(c.object);
      if (k?.type !== "Literal" || typeof k.value !== "string") return "unknown";
      classes.add(k.value);
      return inner;
    },
  };
  return schemaRead(expr, file, project, q) === "unknown" ? undefined : classes;
}
