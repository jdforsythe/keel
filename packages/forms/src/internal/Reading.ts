/** What an element currently holds for its field: a typed value, nothing, or text the schema cannot coerce. */
export type Reading =
  | { readonly kind: "value"; readonly value: unknown }
  | { readonly kind: "absent" }
  | { readonly kind: "raw"; readonly text: string };
