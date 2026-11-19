import { manifest } from "@keel/router";
import DonePage from "./DonePage.tsx";
import NotesPage from "./NotesPage.tsx";
import { postNote } from "./postNote.ts";

export const routes = manifest({
  "notes.home": { path: "/", component: NotesPage },
  "notes.done": { path: "/done", component: DonePage },
});
routes.actions({ "notes.home": { POST: postNote } });
