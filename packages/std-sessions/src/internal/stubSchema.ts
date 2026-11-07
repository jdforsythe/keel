import type { JsonValue, Result, Schema, SchemaError } from "@keel/schema";
import { s } from "@keel/schema";
import { notImplemented } from "./notImplemented.ts";

/** A `Schema<T>` placeholder whose `parse` and `encode` throw until backlog 0092 declares the real shape. */
export function stubSchema<T>(name: string): Schema<T> {
  return {
    node: s.json().node,
    isOptional: false,
    parse: (_input: unknown): Result<T, SchemaError> => {
      throw notImplemented(`${name}.parse`);
    },
    encode: (_value: unknown): JsonValue => {
      throw notImplemented(`${name}.encode`);
    },
    doc: () => name,
    optional: () => stubOptional<T>(name),
    nullable: () => stubSchema<T | null>(name),
  };
}

function stubOptional<T>(name: string): Schema<T, true> {
  return {
    node: s.json().node,
    isOptional: true,
    parse: (_input: unknown): Result<T, SchemaError> => {
      throw notImplemented(`${name}.parse`);
    },
    encode: (_value: unknown): JsonValue => {
      throw notImplemented(`${name}.encode`);
    },
    doc: () => name,
    optional: () => stubOptional<T>(name),
    nullable: () => stubOptional<T | null>(name),
  };
}
