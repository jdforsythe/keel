import { type Infer, s } from "@keel/schema";
import { ShiftOpen } from "./ShiftOpen.schema.ts";

export const ShiftList = s.object({ items: s.array(ShiftOpen) });
export type ShiftList = Infer<typeof ShiftList>;
