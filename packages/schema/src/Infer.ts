import type { Result } from "./Result.ts";
import type { SchemaError } from "./SchemaError.ts";

/** The TypeScript type a schema accepts. Also spelled `s.infer<typeof X>`. */
export type Infer<S> = S extends { parse(input: unknown): Result<infer T, SchemaError> } ? T : never;
