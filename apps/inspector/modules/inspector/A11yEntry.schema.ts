import { s } from "@keel/schema";

/** One `a11y.json` entry (k.compiler): the expected role and the source of the accessible name. */
export const A11yEntry = s.object({
  role: s.string().nullable(),
  name: s.enum(["label", "alt", "text", "aria", "none"]),
  tag: s.string(),
});
