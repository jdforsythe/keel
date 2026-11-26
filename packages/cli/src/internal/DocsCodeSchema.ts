import { s } from "@keel/schema";

/** `keel docs --for <block>`: one code of the block and the installed sections citing it, in map order. */
export const DocsCodeSchema = s.object({
  kind: s.literal("docs.code"),
  code: s.string(),
  ids: s.array(s.string()),
});
