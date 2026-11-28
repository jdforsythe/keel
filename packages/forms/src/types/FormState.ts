import type { formHandle } from "@keel/router/internal";
import type { KeelError, Result, SchemaError } from "@keel/schema";
import type { DeepPartial } from "./DeepPartial.ts";
import type { Field } from "./Field.ts";
import type { FieldPath } from "./FieldPath.ts";
import type { PathValue } from "./PathValue.ts";
import type { Unbranded } from "./Unbranded.ts";

/** The handle `form(schema)` returns (k.forms). Reads are reactive. */
export interface FormState<T> {
  /**
   * The field at a dotted path. A literal path must be a `FieldPath<T>` (compile error otherwise) and gives a
   * typed Field; a computed `string` is accepted and checked at runtime. A path not in the schema throws E1902.
   */
  field<P extends FieldPath<T> | (string & {})>(
    path: string extends P ? P : P & FieldPath<T>,
  ): Field<string extends P ? unknown : Unbranded<PathValue<T, P & string>>>;
  values(): DeepPartial<T>;
  /** Field path -> message. */
  errors(): Readonly<Record<string, string>>;
  /** True from submit until the action's response; written only by `<Form>` through the seam's `setPending`. */
  pending(): boolean;
  /** Values back to `initial`; errors and touched cleared. */
  reset(): void;
  /** The `<Form form>` seam (`@keel/router/internal`, RFC 0045); not public API. */
  readonly [formHandle]: {
    /** `<Form>` sets pending true when it sends the action and false when the response arrives. */
    setPending(value: boolean): void;
    /**
     * Validate every field and set an error for every schema issue (issues no `field()` covers are also summarised
     * under the root path `''`); focus the first invalid bound element in document order.
     */
    validate(): Result<T, SchemaError>;
    /**
     * Take a rejected post the page re-renders (k.forms Submit): each submitted text read for its field as an input
     * would read it, then exactly the `keel.fields` errors.
     */
    restore(
      values: Readonly<Record<string, string | readonly string[]>>,
      errors: Readonly<Record<string, string>>,
    ): void;
    /** Apply the action's Result (ok resets; keel.fields sets exactly those errors; other err: no change). */
    onResult(result: Result<unknown, KeelError<string, unknown>>): void;
  };
}
