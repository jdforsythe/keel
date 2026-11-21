import { s } from "@keel/schema";
import { transaction } from "@keel/store";
import { notes } from "./notes.ts";

/** The feed's first chunk. */
export const setPeek = transaction(notes, "notes.peek", s.object({ peek: s.string() }), (st, p) => ({ ...st, ...p }));
