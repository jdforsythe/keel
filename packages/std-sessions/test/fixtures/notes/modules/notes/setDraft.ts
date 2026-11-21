import { s } from "@keel/schema";
import { transaction } from "@keel/store";
import { notes } from "./notes.ts";

/** The draft as typed. */
export const setDraft = transaction(notes, "notes.draft", s.object({ draft: s.string() }), (st, p) => ({
  ...st,
  ...p,
}));
