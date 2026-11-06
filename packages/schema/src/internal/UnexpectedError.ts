import type { KeelError } from "../KeelError.ts";

/** What `attempt` returns when its function throws or rejects. */
export type UnexpectedError = KeelError<"keel.unexpected", { cause: string }>;
