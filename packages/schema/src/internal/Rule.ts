/** Closed set of reasons a value fails a schema (k.schema SchemaError). */
export type Rule =
  | "type"
  | "finite"
  | "int"
  | "min"
  | "max"
  | "literal"
  | "enum"
  | "required"
  | "optional-null"
  | "nullable-absent"
  | "discriminant"
  | "secret-missing";
