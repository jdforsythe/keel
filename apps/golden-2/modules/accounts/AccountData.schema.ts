import { s } from "@keel/schema";
import { AccountsText } from "./AccountsText.schema.ts";

/** What an account page loads: its copy, and the email the request is signed in as when it is. */
export const AccountData = s.object({ text: AccountsText, email: s.string().pii("contact").optional() });

export type AccountData = s.infer<typeof AccountData>;
