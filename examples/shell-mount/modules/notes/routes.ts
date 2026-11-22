import { manifest } from "@keel/router";
import HomePage from "./HomePage.tsx";
import NotePage from "./NotePage.tsx";
import SigninPage from "./SigninPage.tsx";
import { notes } from "./notes.contract.ts";
import { signedIn } from "./signedIn.guard.ts";

export const routes = manifest(notes, {
  "notes.home": { component: HomePage, title: () => "Notes" },
  "notes.note": { component: NotePage, guard: signedIn, title: (p) => `Note ${p.params.noteId}` },
  "notes.signin": { component: SigninPage, title: () => "Sign in" },
});
