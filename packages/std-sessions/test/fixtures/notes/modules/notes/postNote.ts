import { action } from "@keel/router";
import { ok } from "@keel/schema";
import { tx } from "@keel/store";
import { NoteForm } from "./NoteForm.schema.ts";
import { addNote } from "./addNote.ts";
import { notes } from "./notes.ts";
import { routes } from "./routes.ts";

/** POST on `notes.home`: post the draft to the server, keep it with the caller it answers, and go to `notes.done`. */
export const postNote = action({ input: NoteForm }, async (_input, { url }, ctx) => {
  const body = JSON.stringify({ text: notes.get("draft") });
  const res = await ctx.net.fetch(new Request(`${new URL(url).origin}/api/notes`, { method: "POST", body }));
  await tx(addNote, { caller: await res.text() });
  return ok(routes.href("notes.done"));
});
