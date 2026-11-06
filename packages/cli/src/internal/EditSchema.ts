import { s } from "@keel/schema";

/** One file of a scaffold/codemod edit set; `diff` (unified) only under `--dry-run`. */
export const EditSchema = s.object({
  kind: s.literal("scaffold.edit"),
  action: s.enum(["create", "change", "remove"]),
  path: s.string(),
  diff: s.string().optional(),
});
