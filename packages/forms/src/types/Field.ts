import type { Bindable } from "../internal/Bindable.ts";

/** One field of a form (k.forms Bindings). Reads are reactive. */
export interface Field<T> {
  /** The dotted path; also the `name` attribute, so native FormData decodes by the schema. */
  readonly name: string;
  readonly id: string;
  /** Id of the element holding the error text; bound inputs name it in `aria-describedby` while invalid. */
  readonly errorId: string;
  value(): T | undefined;
  error(): string | undefined;
  touched(): boolean;
  /** Set the value; `undefined` makes the key absent. Validates if the field has shown an error. */
  set(value: T | undefined): void;
  /** Mark touched and validate the field. */
  blur(): void;
  /** Attach to a plain input, select, or textarea. Returns unbind; also unbound when the calling scope is disposed. */
  bind(el: Bindable): () => void;
}
