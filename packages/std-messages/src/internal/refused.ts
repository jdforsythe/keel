import { type SchemaError, defect } from "@keel/schema";

/** Raises `load`'s rejection (std.messages): a defect whose `cause` holds the schema issues, with no locale text and no file path. */
export function refused(e: SchemaError): never {
  return defect("messages: the entry fails the set", { cause: e });
}
