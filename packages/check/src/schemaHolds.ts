import type { Argument } from "oxc-parser";
import { schemaRead } from "./internal/schemaRead.ts";
import type { RuleInput } from "./types/RuleInput.ts";
import type { SchemaName } from "./types/SchemaName.ts";

/**
 * Whether the schema expression `expr` of `input.file` holds a part `names` lists (k.privacy-reads Readers): an
 * export `{ from, name }` imported by name under any local name, or `<ns>.<name>` of a namespace import of `from`,
 * read through `input.project` as E1111 reads a schema. `'yes'` when a part is listed; else `'unknown'` where a part
 * cannot be read (a factory call, a binding it cannot follow, a computed member, a getter, setter or method, a binding
 * changed after its literal); else `'no'`. An export of a package `names` does not list is `'no'`.
 */
export function schemaHolds(expr: Argument, input: RuleInput, names: readonly SchemaName[]): "yes" | "unknown" | "no" {
  return schemaRead(expr, input.file, input.project, {
    pkg: (at) => (names.some((n) => n.from === at.package && n.name === at.name) ? "yes" : "no"),
    global: "unknown",
  });
}
