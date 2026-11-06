import type { Issue } from "./Issue.ts";

/** Render issues for an exception message (encode of an invalid value is unexpected). */
export function issueText(issues: readonly Issue[]): string {
  const shown = issues.slice(0, 5).map((i) => `${i.rule} at ${i.path.length === 0 ? "root" : i.path.join(".")}`);
  return `schema.invalid: ${shown.join("; ")}${issues.length > 5 ? ` (+${issues.length - 5} more)` : ""}`;
}
