import { s } from "@keel/schema";

/** `keel docs`: one section or skill of the installed docs, and whether its package is installed. */
export const DocsEntrySchema = s.object({
  kind: s.literal("docs.entry"),
  id: s.string(),
  title: s.string(),
  package: s.string(),
  installed: s.boolean(),
});
