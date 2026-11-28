import { s } from "@keel/schema";

/** The `accounts` API routes' error answer: a public KeelError. */
export const ErrorReply = s.object({ code: s.string(), message: s.string(), data: s.json() });

export type ErrorReply = s.infer<typeof ErrorReply>;
