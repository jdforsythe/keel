import type { SchemaError } from "../SchemaError.ts";
import { pathToString } from "../pathToString.ts";
import type { Issue } from "./Issue.ts";
import { clip } from "./clip.ts";

/** Wrap collected issues as the `schema.invalid` KeelError; message summarises the first issue (< 90 chars). */
export function invalid(issues: Issue[]): SchemaError {
  const first = issues[0];
  const where = first === undefined || first.path.length === 0 ? "root" : clip(pathToString(first.path));
  const more = issues.length > 1 ? ` (+${issues.length - 1} more)` : "";
  return { code: "schema.invalid", message: `${first?.rule ?? "type"} at ${where}${more}`, data: { issues } };
}
