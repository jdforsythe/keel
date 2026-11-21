import { s } from "@keel/schema";

/** The locales golden-2 serves; `en-US` URLs carry no prefix (k.prefix). */
export const AppLocale = s.enum(["en-US", "de-DE", "ja-JP"], { pathDefault: "en-US" });

export type AppLocale = s.infer<typeof AppLocale>;
