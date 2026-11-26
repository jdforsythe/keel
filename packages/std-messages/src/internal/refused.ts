import type { SchemaError } from "@keel/schema";
import { setFault } from "../../unsafe/setFault.ts";

/** Throws `load`'s rejection (std.messages): the schema issues as JSON, with no locale text and no file path. */
export function refused(e: SchemaError): never {
  return setFault(`messages: ${JSON.stringify(e.data.issues)}`);
}
