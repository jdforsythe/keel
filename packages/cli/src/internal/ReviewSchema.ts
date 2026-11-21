import { s } from "@keel/schema";

/** One `keel review` finding (k.review Findings; OUTPUT.md). */
export const ReviewSchema = s.object({
  kind: s.literal("review"),
  code: s.string(),
  path: s.string(),
  line: s.int(),
  col: s.int(),
  message: s.string(),
  protection: s.string(),
  opt: s.boolean(),
  danger: s.enum(["critical", "high", "medium", "low"]),
  novelty: s.enum(["new", "changed", "standing", "accepted"]),
  loud: s.enum(["fail", "warn", "list", "count"]),
  id: s.string(),
  reason: s.string().optional(),
});
