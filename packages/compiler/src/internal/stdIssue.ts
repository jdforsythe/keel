import { type Schema, pathToString } from "@keel/schema";

/**
 * Why `value` fails `schema` (k.module E1158, rfc:0066): ` at <path> (<rule>)` of the first issue, path `.` at the
 * root and clipped to 28 chars; undefined when it parses or there is no schema.
 */
export function stdIssue(schema: Schema<unknown, boolean> | undefined, value: unknown): string | undefined {
  const r = schema?.parse(value);
  if (r === undefined || r.ok) return undefined;
  const issue = r.error.data.issues[0];
  const at = (issue === undefined ? "" : pathToString(issue.path)) || ".";
  return `at ${at.length > 28 ? `${at.slice(0, 25)}...` : at} (${issue?.rule ?? "type"})`;
}
