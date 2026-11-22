import { contract } from "@keel/router/contract";
import { NoteParams } from "./NoteParams.schema.ts";
import { SigninSearch } from "./SigninSearch.schema.ts";

/** The shell's pages: a home page with a link to a note, the note behind the sign-in guard, and the sign-in page. */
export const notes = contract("notes", {
  "notes.home": { path: "/" },
  "notes.note": { path: "/notes/:noteId", params: NoteParams },
  "notes.signin": { path: "/signin", search: SigninSearch },
});
