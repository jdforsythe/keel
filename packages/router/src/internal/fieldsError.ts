import { type KeelError, type SchemaError, pathToString } from "@keel/schema";
import type { SchemaNode } from "./SchemaNode.ts";
import { messageFor } from "./messageFor.ts";
import { nodeAt } from "./nodeAt.ts";

/** FormData that fails the action's input schema: `keel.fields` with `{ [path]: message }` (k.forms, k.server). */
export function fieldsError(
  root: SchemaNode,
  e: SchemaError,
): KeelError<"keel.fields", Readonly<Record<string, string>>> {
  const data: Record<string, string> = {};
  for (const i of e.data.issues) {
    const key = pathToString(i.path);
    if (!Object.hasOwn(data, key)) data[key] = messageFor(nodeAt(root, i.path), i.rule);
  }
  return { code: "keel.fields", message: "keel.fields", data };
}
