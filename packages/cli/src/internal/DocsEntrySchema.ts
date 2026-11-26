import { s } from "@keel/schema";

/** `keel docs`, `keel docs <area>`: one section or skill, whether its package is installed, what it holds. */
export const DocsEntrySchema = s.object({
  kind: s.literal("docs.entry"),
  id: s.string(),
  title: s.string(),
  package: s.string(),
  installed: s.boolean(),
  holds: s.string(),
});
