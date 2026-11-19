import { s } from "@keel/schema";
import { transaction } from "@keel/store";
import { notes } from "./notes.ts";

/** Keep the draft as a note, with the caller the server named for its write. */
export const addNote = transaction(notes, "notes.add", s.object({ caller: s.string() }), (st, p) => ({
  ...st,
  items: [...st.items, st.draft],
  caller: p.caller,
}));
