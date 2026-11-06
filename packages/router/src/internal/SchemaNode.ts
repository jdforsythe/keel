import type { Schema } from "@keel/schema";

/** The descriptor tree of a schema (`schema.node`), walked for route validation and `routes.json`. */
export type SchemaNode = Schema<unknown>["node"];
