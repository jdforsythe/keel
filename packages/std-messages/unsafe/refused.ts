import type { SchemaError } from "@keel/schema";
import { unsafe } from "./unsafe.ts";

/** Throws `load`'s rejection (std.messages): the schema issues as JSON, with no locale text and no file path. */
export function refused(e: SchemaError): never {
  return unsafe(
    "std.messages specifies that a locale file failing its set throws however it is imported, and that load rejects for a locale outside the set: a locale file is the app's own source, so the throw surfaces at import or as the rejection of the dynamic import, as a module error does",
    () => {
      throw new Error(`messages: ${JSON.stringify(e.data.issues)}`);
    },
  );
}
