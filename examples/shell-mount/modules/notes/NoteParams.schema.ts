import { s } from "@keel/schema";

export const NoteParams = s.object({ noteId: s.string({ min: 1, max: 40 }) });
