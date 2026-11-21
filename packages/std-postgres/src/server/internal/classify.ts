import type { Conflict } from "../../Conflict.ts";
import type { ConstraintError } from "../../ConstraintError.ts";
import type { Unreachable } from "../../Unreachable.ts";
import { errors } from "./errors.ts";

const KINDS: Readonly<Record<string, ConstraintError["data"]["kind"]>> = {
  "23505": "unique",
  "23503": "foreign",
  "23514": "check",
  "23502": "notNull",
};
const SERIAL = new Set(["40001", "40P01"]);
const LOST = new Set(["57P01", "57P02", "57P03", "53300"]);
const NET = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "EPIPE", "EHOSTUNREACH", "EAI_AGAIN"]);

const field = (e: unknown, name: string): string => {
  const v: unknown = typeof e === "object" && e !== null ? Reflect.get(e, name) : undefined;
  return typeof v === "string" ? v : "";
};

/** What a driver error is: an expected error of the API, or `null` for one that throws. */
export type Classified = ConstraintError | Unreachable | Conflict | null;

/**
 * A driver error as std.postgres answers it (Errors): a unique, foreign key, check or not-null violation is
 * `postgres.constraint`; a serialization failure or deadlock `keel.conflict`; a refused or lost connection
 * `keel.unreachable`; anything else `null`, for `unexpected` to throw.
 */
export function classify(e: unknown): Classified {
  const code = field(e, "code");
  const kind = KINDS[code];
  if (kind !== undefined) {
    const constraint = field(e, "constraint") || field(e, "column");
    return { code: "postgres.constraint", message: "A row breaks a constraint", data: { constraint, kind } };
  }
  if (SERIAL.has(code)) return errors.conflict;
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

/** Whether a driver error is a serialization failure or deadlock. */
export const isSerial = (e: unknown): boolean => SERIAL.has(field(e, "code"));

/**
 * The error a database error that is not expected throws: its SQLSTATE only, since Postgres's message can quote a
 * value. An error that is not the database's (no `severity`: std.postgres's own E-codes, a driver's usage error)
 * passes through.
 */
export function unexpected(e: unknown): unknown {
  const code = field(e, "code");
  if (field(e, "severity") === "") return e;
  const out = Object.assign(
    new Error(`std.postgres: the database answered SQLSTATE ${code === "" ? "unknown" : code}`),
    { code },
  );
  Object.defineProperty(out, "code", { enumerable: false });
  return out;
}
