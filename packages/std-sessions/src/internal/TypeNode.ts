import type { Schema } from "@keel/schema";

/** The descriptor tree of a schema (k.schema `node`), named here since `@keel/schema` exports only the schema type. */
export type TypeNode = Schema<unknown, boolean>["node"];
