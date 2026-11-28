import type { ConstraintError } from "../ConstraintError.schema.ts";
import { constraintNames } from "./internal/constraintNames.server.ts";

/**
 * The member of `names`, a list the app wrote, that names the constraint `e` broke (a not-null violation's column), or
 * `undefined` (std.postgres): a constraint's name reaches app code only as a literal of its own list. A copy of `e`,
 * or an error from another process, names none.
 */
export function constraintOf<const N extends readonly [string, ...string[]]>(
  e: ConstraintError,
  names: N,
): N[number] | undefined {
  const name = constraintNames.get(e);
  return names.find((n) => n === name);
}
