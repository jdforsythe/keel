import type { Conflict } from "../../Conflict.ts";
import type { ConstraintError } from "../../ConstraintError.ts";
import type { Unreachable } from "../../Unreachable.ts";
import { errors } from "./errors.server.ts";
import { field } from "./field.server.ts";
import { isSerial } from "./isSerial.server.ts";

const KINDS: Readonly<Record<string, ConstraintError["data"]["kind"]>> = {
  "23505": "unique",
  "23503": "foreign",
  "23514": "check",
  "23502": "notNull",
};
const LOST = new Set(["57P01", "57P02", "57P03", "53300"]);
const NET = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "EPIPE", "EHOSTUNREACH", "EAI_AGAIN"]);

/**
 * A driver error as std.postgres answers it (Errors): a unique, foreign key, check or not-null violation is
 * `postgres.constraint`; a serialization failure or deadlock `keel.conflict`; a refused or lost connection
 * `keel.unreachable`; anything else `null`, for `unexpected` to throw.
 */
export function classify(e: unknown): ConstraintError | Unreachable | Conflict | null {
  const code = field(e, "code");
  const kind = KINDS[code];
  if (kind !== undefined) {
    const constraint = field(e, "constraint") || field(e, "column");
    return { code: "postgres.constraint", message: "A row breaks a constraint", data: { constraint, kind } };
  }
  if (isSerial(e)) return errors.conflict;
  if (code.startsWith("08") || LOST.has(code) || NET.has(code)) return errors.unreachable;
  const message = e instanceof Error ? e.message : "";
  if (
    code === "" &&
    /Connection terminated|connection timeout|timeout exceeded when trying to connect|Client has encountered a connection error/i.test(
      message,
    )
  )
    return errors.unreachable;
  return null;
}
