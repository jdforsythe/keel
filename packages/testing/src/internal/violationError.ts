import type { Violation } from "./Violation.ts";
import { fail } from "./fail.ts";

/**
 * The harness failure for `violations` under `code`, naming the first and up to four more, then `... +N more`. An
 * axe-core violation line starts with its rule id; E1804 and E1821 lines are their own rule and start at the element.
 */
export function violationError(code: string, violations: readonly Violation[]): Error {
  const line = (v: Violation): string => `${v.rule === code ? "" : `${v.rule}: `}${v.at} ${v.help}`;
  const [first, ...rest] = violations;
  const more = rest.slice(0, 4).map((v) => `\n  ${code} ${line(v)}`);
  const tail = violations.length > 5 ? `\n  ... +${violations.length - 5} more ${code}` : "";
  return fail(code, `${first === undefined ? "" : line(first)}${more.join("")}${tail}`, { violations });
}
