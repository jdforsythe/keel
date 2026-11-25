import { type Infer, s } from "@keel/schema";
import { line } from "@keel/std-text";

/** A shift and how many of its places are still open: what every visitor may see. */
export const ShiftOpen = s.object({
  id: s.string(),
  title: line({ max: 80 }),
  when: line({ max: 80 }),
  slots: s.int({ min: 1, max: 50 }),
  open: s.int({ min: 0, max: 50 }),
});
export type ShiftOpen = Infer<typeof ShiftOpen>;
