import type { KeelError } from "@keel/schema";

/** A serialization failure or deadlock that a lone statement or `transaction` did not get past in 3 runs (std.postgres); k.server answers 409. */
export type Conflict = KeelError<"keel.conflict", null>;
