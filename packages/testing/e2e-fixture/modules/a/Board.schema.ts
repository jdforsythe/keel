import { s } from "@keel/schema";
export const Board = s.object({ lists: s.array(s.string()) });
