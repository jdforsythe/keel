import { type KeelError, type SchemaError, pathToString } from "@keel/schema";

/** FormData that fails the action's input schema: `keel.fields` with `{ [path]: rule }` (k.forms, k.server). */
export function fieldsError(e: SchemaError): KeelError<"keel.fields", Readonly<Record<string, string>>> {
  return {
    code: "keel.fields",
    message: "keel.fields",
    data: Object.fromEntries(e.data.issues.map((i) => [pathToString(i.path), i.rule])),
  };
}
