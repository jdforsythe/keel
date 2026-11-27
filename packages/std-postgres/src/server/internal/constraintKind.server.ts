import type { ConstraintError } from "../../ConstraintError.schema.ts";
import { field } from "./field.server.ts";

const KINDS: Readonly<Record<string, ConstraintError["data"]["kind"]>> = {
  "23505": "unique",
  "23P01": "unique",
  "23503": "foreign",
  "23001": "foreign",
  "23514": "check",
  "23502": "notNull",
};

/** The kind of the constraint a class `23` driver error `e` breaks; a code of the class not listed is `check`. */
export function constraintKind(e: unknown): ConstraintError["data"]["kind"] {
  return KINDS[field(e, "code")] ?? "check";
}
