import { s } from "@keel/schema";

/** `keel docs <name>`: one skill's `SKILL.md` verbatim, with the running `@keel/cli`'s version (absent in the Keel repo). */
export const DocsSkillSchema = s.object({
  kind: s.literal("docs.skill"),
  id: s.string(),
  version: s.string().optional(),
  text: s.string(),
});
