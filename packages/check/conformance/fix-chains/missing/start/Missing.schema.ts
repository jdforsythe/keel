import { s } from "@keel/schema";
export const Missing = s.error("shop.missing", s.object({ id: s.string() }));
