import { unsafe } from "./unsafe.ts";

/** Restore the schema-derived static type of a value the form has already proven against its schema node. */
export function asSchemaValue<T>(x: unknown): T {
  return unsafe(
    "form state stores only values coerced to the schema node at their path (uncoercible text is kept apart), and a parse ok proves the whole value; TS cannot relate a generic schema S to Infer<S>",
    () => x as T,
  );
}
