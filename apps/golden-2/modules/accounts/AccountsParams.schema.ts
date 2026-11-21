import { s } from "@keel/schema";
import { AccountsLocale } from "./AccountsLocale.schema.ts";

/** The params of an account page: its locale. */
export const AccountsParams = s.object({ locale: AccountsLocale });

export type AccountsParams = s.infer<typeof AccountsParams>;
