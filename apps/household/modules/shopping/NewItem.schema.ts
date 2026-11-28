import { s } from "@keel/schema";

export const NewItem = s.object({ name: s.string({ min: 1, max: 60 }) });
