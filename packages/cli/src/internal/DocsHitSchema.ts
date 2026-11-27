import { s } from "@keel/schema";

/** `keel docs --for <name>`: an installed section holding the name in `count` of its code spans. */
export const DocsHitSchema = s.object({
  kind: s.literal("docs.hit"),
  name: s.string(),
  id: s.string(),
  title: s.string(),
  package: s.string(),
  count: s.int(),
});
