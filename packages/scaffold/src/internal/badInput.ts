import type { Result, SchemaError } from "@keel/schema";
import type { ScaffoldError } from "../types/ScaffoldError.ts";
import { fail } from "./fail.ts";

/** E1052: the input does not fit the operation's input schema. */
export function badInput(op: string, e: SchemaError): Result<never, ScaffoldError> {
  const issue = e.data.issues[0];
  const at = issue === undefined ? "" : ` at ${issue.path.join(".")} (${issue.rule})`;
  return fail("E1052", op, `${op}: input does not fit its schema${at}`);
}
