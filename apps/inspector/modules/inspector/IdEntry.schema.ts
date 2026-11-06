import { s } from "@keel/schema";

/** One `ids.json` entry (k.compiler): where an element is declared and what it is. */
export const IdEntry = s.object({
  file: s.string(),
  line: s.int(),
  col: s.int(),
  component: s.string(),
  tag: s.string(),
  role: s.string().nullable(),
});
