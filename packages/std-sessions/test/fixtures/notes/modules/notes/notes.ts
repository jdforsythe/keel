import { store } from "@keel/store";
import { Notes } from "./Notes.schema.ts";

/** The user's notes. */
export const notes = store(Notes, { draft: "", items: [], caller: "", peek: "" }, { id: "notes.notes" });
