import { s } from "@keel/schema";

/** `keel docs --for <code>`: one line of an installed section citing the code. */
export const DocsCiteSchema = s.object({
  kind: s.literal("docs.cite"),
  code: s.string(),
  id: s.string(),
  line: s.int(),
  text: s.string(),
});
