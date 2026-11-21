import { type SchemaError, pathToString } from "@keel/schema";
import type { FieldIssue } from "../types/FieldIssue.ts";
import type { Node } from "./Node.ts";

type Issue = SchemaError["data"]["issues"][number];

/** The `FieldIssue` for a schema issue, its constraint read from `node`, the schema node at the issue's path. */
export function fieldIssue(node: Node | undefined, issue: Issue): FieldIssue {
  let n = node;
  let format: string | undefined;
  while (n !== undefined && (n.kind === "optional" || n.kind === "nullable" || n.kind === "format")) {
    if (n.kind === "format") {
      format ??= n.name;
      n = n.base;
    } else n = n.inner;
  }
  const out: { -readonly [K in keyof FieldIssue]: FieldIssue[K] } = {
    rule: issue.rule,
    path: pathToString(issue.path),
  };
  if (n?.kind === "string" || n?.kind === "number" || n?.kind === "int") {
    if (n.min !== undefined) out.min = n.min;
    if (n.max !== undefined) out.max = n.max;
  } else if (n?.kind === "enum") out.values = n.values;
  else if (n?.kind === "literal") out.values = [n.value];
  if (format !== undefined) out.format = format;
  return out;
}
