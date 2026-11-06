import type { Signal } from "@keel/reactive";
import type { KeelError, Result, SchemaError } from "@keel/schema";

/**
 * Router seam: what `<Form form>` (@keel/router) calls; mirrors packages/router/src/types/FormHandle.ts (onResult
 * widened to `unknown` ok values). Local copy until @keel/router exports `FormHandle` from its index;
 * `FormState` must stay structurally assignable to it (checked in test/seam.test.ts).
 */
export interface FormHandle {
  readonly pending: Signal<boolean>;
  values(): Record<string, unknown>;
  onResult(r: Result<unknown, KeelError<string, unknown>>): void;
  validate(): Result<unknown, SchemaError>;
}
