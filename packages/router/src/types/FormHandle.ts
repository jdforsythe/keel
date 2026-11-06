import type { KeelError, Result, SchemaError } from "@keel/schema";
import type { Href } from "./Href.ts";

/**
 * The seam `<Form form>` calls (implemented by `form()` in @keel/forms). On submit the router calls
 * `validate()` (an `err` stops the submit; the handle shows the errors), `setPending(true)`, runs the
 * action, `setPending(false)`, then `onResult` with the action's Result.
 */
export interface FormHandle {
  setPending(v: boolean): void;
  values(): Record<string, unknown>;
  onResult(r: Result<Href | null, KeelError<string, unknown>>): void;
  validate(): Result<unknown, SchemaError>;
}
