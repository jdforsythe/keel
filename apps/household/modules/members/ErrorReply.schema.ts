import { s } from "@keel/schema";

/** The members API's error answer: a public KeelError. */
export const ErrorReply = s.object({ code: s.string(), message: s.string(), data: s.json() });
