import { s } from "@keel/schema";

/** The locales the account pages serve, the recipe pages' three; `en-US` URLs carry no prefix (k.prefix). */
export const AccountsLocale = s.enum(["en-US", "de-DE", "ja-JP"], { pathDefault: "en-US" });

export type AccountsLocale = s.infer<typeof AccountsLocale>;
