import { field } from "./field.ts";

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
    {
      code,
    },
  );
  Object.defineProperty(out, "code", { enumerable: false });
  return out;
}
