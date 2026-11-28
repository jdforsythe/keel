import { s } from "@keel/schema";
export const Feed = s.object({ items: s.array(s.string()) });
