import { s } from "@keel/schema";

export const ErrorReply = s.object({
  ok: s.literal(false),
  error: s.object({ code: s.string(), message: s.string(), data: s.json() }),
});

export type ErrorReply = s.infer<typeof ErrorReply>;
