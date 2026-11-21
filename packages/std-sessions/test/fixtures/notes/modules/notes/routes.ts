import { manifest } from "@keel/router";
import DonePage from "./DonePage.tsx";
import NotesPage from "./NotesPage.tsx";
import { notes } from "./notes.contract.ts";
import { postNote } from "./postNote.ts";

export const routes = manifest(notes, {
  "notes.home": { component: NotesPage, POST: postNote },
  "notes.done": { component: DonePage },
});
