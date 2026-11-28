import type { KeelError } from "@keel/schema";

/** `one` of a statement that returned no row (std.postgres); k.server answers 404. */
export type NotFound = KeelError<"keel.notFound", null>;
