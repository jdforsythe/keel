import type { KeelError } from "@keel/schema";

/** A serialization failure or deadlock that `transaction` did not get past in 3 runs, or one outside `transaction` (std.postgres); k.server answers 409. */
export type Conflict = KeelError<"keel.conflict", null>;
