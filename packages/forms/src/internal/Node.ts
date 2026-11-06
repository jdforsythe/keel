import type { Schema } from "@keel/schema";

/** The schema descriptor tree (`schema.node`); @keel/schema does not export the type by name. */
export type Node = Schema<unknown, boolean>["node"];
