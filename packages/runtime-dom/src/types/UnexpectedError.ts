import type { KeelError } from "@keel/schema";

/** The error a Boundary fallback receives (k.errors). */
export type UnexpectedError = KeelError<"keel.unexpected", { at: string }>;
