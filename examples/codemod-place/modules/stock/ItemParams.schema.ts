import { s } from "@keel/schema";

export const ItemParams = s.object({ item: s.string({ min: 1, max: 40 }) });
