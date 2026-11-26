import { s } from "@keel/schema";

/** `keel docs --for <name>`: the glossary term equal to the name ignoring case, and the sections its text cites. */
export const DocsTermSchema = s.object({
  kind: s.literal("docs.term"),
  term: s.string(),
  text: s.string(),
  ids: s.array(s.string()),
});
