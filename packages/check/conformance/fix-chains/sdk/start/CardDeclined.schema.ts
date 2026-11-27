import { s } from "@keel/schema";
export const CardDeclined = s.error("pay.declined", s.object({ reason: s.enum(["funds", "expired", "other"]) }));
