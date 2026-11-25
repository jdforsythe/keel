import type { Argument } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { SchemaQuestion } from "./SchemaQuestion.ts";
import { followRef } from "./followRef.ts";
import { schemaRead } from "./schemaRead.ts";

/** The `@keel/schema` constructors whose arguments are values, never schemas: no part of them holds a `.pii()`. */
const VALUES = new Set(["enum", "literal"]);

/** `part` as one line of source: a call as its callee and `()`, anything else as written. */
function partText(part: Argument, file: SourceFile): string {
  const node = part.type === "CallExpression" ? part.callee : part;
  const text = file.source.slice(node.start, node.end).replace(/\s+/g, " ");
  return part.type === "CallExpression" ? `${text}()` : text;
}

/**
 * The `.pii(class)` classes a store's state schema `expr` of `file` holds (k.leave E1107), read by `schemaRead`, or
 * the first part of `file` it cannot read (`unread`, as one line of source) when a part cannot be read (`'unknown'`,
 * k.privacy-reads) or a `.pii()` names its class other than by a string literal, with every such part (`parts`). The
 * arguments of `s.enum(...)` and `s.literal(...)` are values, not read. A package's schema value holds none the app
 * must list; a package factory's call is read through its source (k.privacy-reads Factories).
 */
export function storeClasses(
  expr: Argument,
  file: SourceFile,
  project: readonly SourceFile[],
):
  | { readonly classes: ReadonlySet<string> }
  | { readonly unread: string; readonly parts: readonly { readonly part: Argument; readonly file: SourceFile }[] } {
  const classes = new Set<string>();
  let unread: string | undefined;
  const parts: { part: Argument; file: SourceFile }[] = [];
  const q: SchemaQuestion = {
    pkg: () => "no",
    global: "no",
    call: (e, at, read) => {
      const c = e.callee;
      if (c.type !== "MemberExpression" || c.computed) return undefined;
      if (VALUES.has(c.property.name)) {
        const ns = followRef(c.object, at, project);
        if (ns !== null && ns !== "global" && "package" in ns && ns.package === "@keel/schema") return "no";
      }
      if (c.property.name !== "pii") return undefined;
      const k = e.arguments[0];
      const inner = read(c.object);
      if (k?.type === "Literal" && typeof k.value === "string") {
        classes.add(k.value);
        return inner;
      }
      if (unread === undefined && project.includes(at)) unread = partText(e, at);
      parts.push({ part: e, file: at });
      return "unknown";
    },
    unread: (part, at) => {
      if (unread === undefined && project.includes(at)) unread = partText(part, at);
      parts.push({ part, file: at });
    },
  };
  if (schemaRead(expr, file, project, q) !== "unknown") return { classes };
  return { unread: unread ?? partText(expr, file), parts };
}
