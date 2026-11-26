import { s } from "@keel/schema";

/** `keel docs`, `keel docs <area>`: one area of the installed docs and the count of its sections. */
export const DocsAreaSchema = s.object({
  kind: s.literal("docs.area"),
  id: s.string(),
  title: s.string(),
  sections: s.int(),
});
