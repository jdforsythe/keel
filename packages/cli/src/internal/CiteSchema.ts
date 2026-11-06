import { s } from "@keel/schema";

/** `keel spec --for <code>`: one spec line citing the code. */
export const CiteSchema = s.object({
  kind: s.literal("spec.cite"),
  code: s.string(),
  path: s.string(),
  line: s.int(),
  text: s.string(),
});
