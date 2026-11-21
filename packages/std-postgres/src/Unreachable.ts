import type { KeelError } from "@keel/schema";

/** A refused or lost connection, or a sim plan step `unavailable` (std.postgres); k.server answers 502. */
export type Unreachable = KeelError<"keel.unreachable", null>;
