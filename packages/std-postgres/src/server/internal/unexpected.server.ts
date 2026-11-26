import { defect } from "@keel/schema";
import { field } from "./field.server.ts";

/**
 * What a database error that is not expected does: a defect E2461 naming its SQLSTATE only, since Postgres's message can
 * quote a value. An error that is not the database's (no `severity`: a driver's usage error) gives `undefined`, so
 * `attempt` passes it on as it is.
 */
export function unexpected(e: unknown): undefined {
  if (field(e, "severity") === "") return undefined;
  const code = field(e, "code");
  return defect(`std.postgres: the database answered SQLSTATE ${code === "" ? "unknown" : code}`, "E2461");
}
