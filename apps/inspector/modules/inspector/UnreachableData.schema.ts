import { s } from "@keel/schema";

/** What `inspector.unreachable` holds: the target, why it could not be inspected, and the status it answered. */
export const UnreachableData = s.object({
  url: s.string(),
  why: s.enum(["status", "decode", "timeout", "unreachable"]),
  status: s.int().optional(),
});
