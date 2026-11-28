import { s } from "@keel/schema";
export const Draft = s.object({ name: s.string({ min: 1 }) });
