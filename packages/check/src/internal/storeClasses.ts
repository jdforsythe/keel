import type { Argument } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { SchemaQuestion } from "./SchemaQuestion.ts";
import { schemaRead } from "./schemaRead.ts";

/** `part` as one line of source: a call as its callee and `()`, anything else as written. */
function partText(part: Argument, file: SourceFile): string {
  const node = part.type === "CallExpression" ? part.callee : part;
  const text = file.source.slice(node.start, node.end).replace(/\s+/g, " ");
  return part.type === "CallExpression" ? `${text}()` : text;
}

/**
 * The `.pii(class)` classes a store's state schema `expr` of `file` holds (k.leave E1107), read by `schemaRead`, or
 * the first part of `file` it cannot read (`unread`, as one line of source) when a part cannot be read (`'unknown'`,
 * k.privacy-reads) or a `.pii()` names its class other than by a string literal. A package's schema value holds none
 * the app must list; a package factory's call is read through its source (k.privacy-reads Factories).
 */
export function storeClasses(
  expr: Argument,
  file: SourceFile,
  project: readonly SourceFile[],
): { readonly classes: ReadonlySet<string> } | { readonly unread: string } {
  const classes = new Set<string>();
  let unread: string | undefined;
  const q: SchemaQuestion = {
    pkg: () => "no",
    global: "no",
    call: (e, at, read) => {
      const c = e.callee;
      if (c.type !== "MemberExpression" || c.computed || c.property.name !== "pii") return undefined;
      const k = e.arguments[0];
      const inner = read(c.object);
      if (k?.type === "Literal" && typeof k.value === "string") {
        classes.add(k.value);
        return inner;
      }
      if (unread === undefined && project.includes(at)) unread = partText(e, at);
      return "unknown";
    },
    unread: (part, at) => {
      if (unread === undefined && project.includes(at)) unread = partText(part, at);
    },
  };
  if (schemaRead(expr, file, project, q) !== "unknown") return { classes };
  return { unread: unread ?? partText(expr, file) };
}
