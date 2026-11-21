import { contract } from "@keel/router/contract";

/** The notes module's pages: the draft at `/`, the notes so far at `/done`. */
export const notes = contract("notes", { "notes.home": { path: "/" }, "notes.done": { path: "/done" } });
