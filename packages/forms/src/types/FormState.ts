import type { Signal } from "@keel/reactive";
import type { KeelError, Result, SchemaError } from "@keel/schema";
import type { DeepPartial } from "./DeepPartial.ts";
import type { Field } from "./Field.ts";
import type { FieldPath } from "./FieldPath.ts";
import type { PathValue } from "./PathValue.ts";

/** The handle `form(schema)` returns (k.forms). Reads are reactive. */
export interface FormState<T> {
  /**
   * The field at a dotted path. A literal path must be a `FieldPath<T>` (compile error otherwise) and gives a
   * typed Field; a computed `string` is accepted and checked at runtime. A path not in the schema throws E1902.
   */
  field<P extends FieldPath<T> | (string & {})>(
    path: string extends P ? P : P & FieldPath<T>,
  ): Field<string extends P ? unknown : PathValue<T, P & string>>;
  values(): DeepPartial<T>;
  /** Field path -> message. */
  errors(): Readonly<Record<string, string>>;
  /** The last non-field action error, rendered by `<Form>`'s `error` slot; cleared on submit and reset. */
  error(): KeelError<string, unknown> | undefined;
  /** Call to read; `<Form>` sets it with `pending.set(true)` when it sends the action. */
  readonly pending: (() => boolean) & Signal<boolean>;
  /** Values back to `initial`; errors, touched, and the action error cleared. */
  reset(): void;
  /** Router seam: validate every field, set errors, focus the first invalid bound element in document order. */
  validate(): Result<T, SchemaError>;
  /** Router seam: apply the action's Result (ok resets; keel.fields sets exactly those errors; else `error()`). */
  onResult(result: Result<unknown, KeelError<string, unknown>>): void;
}
