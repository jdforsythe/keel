import type { KeelError, Result, SchemaError } from "@keel/schema";
import type { Href } from "../types/Href.ts";

/**
 * What `<Form form>` calls on the handle (behind `formHandle`). On submit the router calls `validate()`
 * (an `err` stops the submit; the handle shows the errors), `setPending(true)`, runs the action,
 * `setPending(false)`, then `onResult` with the action's Result. Rendering the post it was sent by, rejected and
 * re-rendered (k.forms Submit), it calls `restore` before its controls bind.
 */
export interface FormSeam {
  restore?(
    values: Readonly<Record<string, string | readonly string[]>>,
    errors: Readonly<Record<string, string>>,
  ): void;
  setPending(v: boolean): void;
  onResult(r: Result<Href | null, KeelError<string, unknown>>): void;
  validate(): Result<unknown, SchemaError>;
}
