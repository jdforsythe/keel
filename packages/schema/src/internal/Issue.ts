import type { SchemaError } from "../SchemaError.ts";

/** One failing path and the rule it broke. */
export type Issue = SchemaError["data"]["issues"][number];
