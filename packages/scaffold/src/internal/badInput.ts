import { type Result, type SchemaError, err } from "@keel/schema";
import type { ScaffoldError } from "../types/ScaffoldError.ts";

/** E1052: the input does not fit the operation's input schema; a missing field is named in `missing`, for a surface to spell. */
export function badInput(op: string, e: SchemaError): Result<never, ScaffoldError> {
  const issue = e.data.issues[0];
  const at = issue === undefined ? "" : ` at ${issue.path.join(".")} (${issue.rule})`;
  const message = `${op}: input does not fit its schema${at}`;
  const field = issue?.rule === "required" && issue.path.length === 1 ? String(issue.path[0]) : undefined;
  const data = { kind: "diag", code: "E1052", path: op, line: 1, col: 1, message, see: "k.scaffold" } as const;
  return err({
    code: "scaffold.rejected",
    message: `E1052 ${message}`,
    data: field === undefined ? data : { ...data, missing: field },
  });
}
