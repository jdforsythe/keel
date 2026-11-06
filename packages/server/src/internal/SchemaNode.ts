import type { Schema } from "@keel/schema";

/** The descriptor tree of a schema (`schema.node`); @keel/schema does not export the type by name. */
export type SchemaNode = Schema<unknown, boolean>["node"];
