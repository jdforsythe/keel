import type { SchemaError } from "@keel/schema";

/** One reason the document is outside the supported subset: a path into the doc and a k.schema rule. */
export type Issue = SchemaError["data"]["issues"][number];
