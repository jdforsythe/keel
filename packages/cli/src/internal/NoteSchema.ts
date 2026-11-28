import { s } from "@keel/schema";

/** A line a scaffold operation prints about a path it writes (k.scaffold Generators); compact `note <path> <note>`. */
export const NoteSchema = s.object({
  kind: s.literal("scaffold.note"),
  path: s.string(),
  note: s.string(),
});
