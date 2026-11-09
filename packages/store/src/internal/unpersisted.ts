import { type SchemaError, pathToString } from "@keel/schema";

/**
 * The error `snapshot()` throws when `part` of store `id` does not survive its codec: it names E1303 and the path
 * of the first issue, since a secret (encoded as the marker) is what fails there.
 */
export function unpersisted(id: string, part: string, error: SchemaError): Error {
  const first = error.data.issues[0];
  const at = first === undefined ? "" : pathToString(first.path);
  const rule = first === undefined ? "" : ` (${first.rule})`;
  return new Error(`E1303: store ${id}: snapshot ${part} at ${at === "" ? "(root)" : at} does not persist${rule}`);
}
