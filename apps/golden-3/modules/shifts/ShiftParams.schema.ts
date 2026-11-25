import { type Infer, s } from "@keel/schema";

export const ShiftParams = s.object({ shiftId: s.string() });
export type ShiftParams = Infer<typeof ShiftParams>;
