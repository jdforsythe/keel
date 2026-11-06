import type { JsonValue } from "./JsonValue.ts";
import type { Result } from "./Result.ts";
import type { SchemaError } from "./SchemaError.ts";
import type { Node } from "./internal/Node.ts";

/**
 * A declared data shape; every derivation walks `node`.
 * `O` is true when the schema was marked `.optional()` (its object key may be absent).
 */
export interface Schema<T, O extends boolean = false> {
  readonly node: Node;
  readonly isOptional: O;
  parse(input: unknown): Result<T, SchemaError>;
  /** Validates first; throws an Error listing the issues when `value` does not fit (unexpected). */
  encode(value: unknown): JsonValue;
  decode(json: unknown): Result<T, SchemaError>;
  doc(): string;
  optional(): Schema<T, true>;
  nullable(): Schema<T | null, O>;
}
