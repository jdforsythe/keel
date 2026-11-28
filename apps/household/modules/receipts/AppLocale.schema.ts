import { s } from "@keel/schema";

export const AppLocale = s.enum(["en-US", "de-DE"], { pathDefault: "en-US" });
