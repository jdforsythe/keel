import { type Result, attempt, err, ok } from "@keel/schema";

/** Parse response text as JSON; an empty body is `null`. Never throws. */
export function readJson(text: string): Result<unknown, null> {
  if (text === "") return ok(null);
  const r = attempt((): unknown => JSON.parse(text));
  return r.ok ? r : err(null);
}
