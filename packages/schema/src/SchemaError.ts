import type { KeelError } from "./KeelError.ts";
import type { Rule } from "./internal/Rule.ts";

/** Why a value does not fit a schema: the KeelError `schema.invalid`, one issue per failing path. */
export type SchemaError = KeelError<"schema.invalid", { issues: { path: (string | number)[]; rule: Rule }[] }>;
