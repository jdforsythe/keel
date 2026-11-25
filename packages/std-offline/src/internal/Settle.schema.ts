import { s } from "@keel/schema";

/** `<id>.settle`: an entry's next state (`sent` removes it), with a conflict's `head` or the `error`. */
export const Settle = s.object({
  key: s.string(),
  state: s.enum(["sent", "queued", "sending", "conflict", "failed"]),
  head: s.int({ min: 0 }).optional(),
  error: s.json().optional(),
});
