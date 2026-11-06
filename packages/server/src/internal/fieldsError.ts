import { type KeelError, type SchemaError, pathToString } from "@keel/schema";
import type { SchemaNode } from "./SchemaNode.ts";
import { messageFor } from "./messageFor.ts";
import { nodeAt } from "./nodeAt.ts";

/**
 * FormData that fails the action's input schema: `keel.fields` with `{ [path]: message }` (k.forms Submit),
 * first issue per path wins.
 */
export function fieldsError(
  root: SchemaNode,
  e: SchemaError,
): KeelError<"keel.fields", Readonly<Record<string, string>>> {
  const data: Record<string, string> = {};
  for (const issue of e.data.issues) {
    const key = pathToString(issue.path);
    if (!Object.hasOwn(data, key)) data[key] = messageFor(nodeAt(root, issue.path), issue.rule);
  }
  return { code: "keel.fields", message: "keel.fields", data };
}
