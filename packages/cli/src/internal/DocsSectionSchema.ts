import { s } from "@keel/schema";

/** `keel docs <id>`: one spec section verbatim, with its package and installed version (absent in the Keel repo). */
export const DocsSectionSchema = s.object({
  kind: s.literal("docs.section"),
  id: s.string(),
  package: s.string().optional(),
  version: s.string().optional(),
  text: s.string(),
});
