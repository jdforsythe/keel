import type { JsonValue, KeelError, Result } from "@keel/schema";
import type { Diag } from "./Diag.ts";

/** One chain level's loader result: the parsed `value` and its `json` encoding, or the error; E1554 adds a diag. */
export type LoaderOutcome = {
  readonly result: Result<{ readonly value: unknown; readonly json: JsonValue }, KeelError<string, unknown>>;
  readonly diag: Diag | null;
};
