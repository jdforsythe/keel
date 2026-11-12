import { s } from "@keel/schema";

/**
 * One queued write (std.offline): its `key` and `base`, the `endpoint` name, the `origin` it goes to, the call `input`
 * without `body.write`, `at` from `ctx.clock`, and `state`. A `conflict` keeps the refusal's `head`; a `failed` entry
 * keeps its `error`.
 */
const OutboxEntryShape = s.object({
  key: s.id("Write"),
  endpoint: s.string(),
  origin: s.string(),
  input: s.json(),
  base: s.int({ min: 0 }),
  at: s.number(),
  state: s.enum(["queued", "sending", "conflict", "failed"]),
  head: s.int({ min: 0 }).optional(),
  error: s.json().optional(),
});
export const OutboxEntry: typeof OutboxEntryShape = OutboxEntryShape;
export type OutboxEntry = s.infer<typeof OutboxEntryShape>;
