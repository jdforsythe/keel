import { store } from "@keel/store";
import { Contact } from "./Contact.schema.ts";

/** The `.pii` store, made in a `*.server.ts` file only; no client file imports this one. */
export const contacts = store(Contact, { email: "", userId: "" }, { id: "app.contacts" });
