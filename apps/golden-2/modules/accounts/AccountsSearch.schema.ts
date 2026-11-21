import { s } from "@keel/schema";
import { AccountError } from "./AccountError.schema.ts";

/** The search of an account page: the refusal of the last form post to the sign-in library, if any. */
export const AccountsSearch = s.object({ error: AccountError.optional() });

export type AccountsSearch = s.infer<typeof AccountsSearch>;
