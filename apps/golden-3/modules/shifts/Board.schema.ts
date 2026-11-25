import { type Infer, s } from "@keel/schema";
import { Shift } from "./Shift.schema.ts";
import { Signup } from "./Signup.schema.ts";

export const Board = s.object({ shifts: s.array(Shift), signups: s.array(Signup) });
export type Board = Infer<typeof Board>;
