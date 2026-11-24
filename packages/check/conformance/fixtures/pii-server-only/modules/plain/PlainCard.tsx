import { store } from "@keel/store";
import { Notes } from "./Notes.schema.ts";

/** A client module's store whose schema holds no `.pii` node. */
export const notes = store(Notes, { title: "" }, { id: "plain.notes" });
