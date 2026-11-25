import { type Infer, s } from "@keel/schema";

export const Attendance = s.object({ attended: s.boolean() });
export type Attendance = Infer<typeof Attendance>;
