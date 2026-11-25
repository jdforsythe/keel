import { type Infer, s } from "@keel/schema";
import { line } from "@keel/std-text";

export const Shift = s.object({
  id: s.string(),
  title: line({ max: 80 }),
  when: line({ max: 80 }),
  slots: s.int({ min: 1, max: 50 }),
});
export type Shift = Infer<typeof Shift>;
