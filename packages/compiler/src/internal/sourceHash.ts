import { hashOf } from "./hashOf.ts";
import { sourceForm } from "./sourceForm.ts";

/** The hash of a file's normal form (`sourceForm`), as `hashOf` hashes an artifact's data; `undefined` when it does not parse. */
export function sourceHash(path: string, source: string): string | undefined {
  const form = sourceForm(path, source);
  return form === undefined ? undefined : hashOf(form);
}
