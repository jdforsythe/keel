import type { JsonValue } from "./JsonValue.ts";
import type { PiiClass } from "./PiiClass.ts";
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
  /** Validates `input`; also the JSON inverse of `encode` (RFC 0043: there is no separate `decode`). */
  parse(input: unknown): Result<T, SchemaError>;
  /** Reads `text` as JSON, then parses it as `parse` does; a text that is no JSON fails rule `json` at `[]` (k.attempt). */
  parseJson(text: string): Result<T, SchemaError>;
  /** Validates first; throws an Error listing the issues when `value` does not fit (unexpected). */
  encode(value: unknown): JsonValue;
  doc(): string;
  optional(): Schema<T, true>;
  /** `JSON.stringify(schema)` writes its node; a format node keeps its name, never its predicate or generator. */
  toJSON(): Node;
  nullable(): Schema<T | null, O>;
  /** Marks this node and every value under it as personal data of `cls` (k.privacy); the type and derivations stay. */
  pii(cls: PiiClass): Schema<T, O>;
}
