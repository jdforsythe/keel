import type { JsonValue, KeelError, Result } from "@keel/schema";
import type { Diag } from "./Diag.ts";

/**
 * One chain level's loader result: the parsed `value` and its `json` encoding, or the error; a throw adds its records
 * (`ThrownRecords`), E1554 its diag.
 */
export type LoaderOutcome = {
  readonly result: Result<{ readonly value: unknown; readonly json: JsonValue }, KeelError<string, unknown>>;
  readonly diags: readonly Diag[];
};
