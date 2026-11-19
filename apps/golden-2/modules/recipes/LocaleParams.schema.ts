import { s } from "@keel/schema";
import { AppLocale } from "./AppLocale.schema.ts";

/** The params of a route under `/:locale` with no other param. */
export const LocaleParams = s.object({ locale: AppLocale });

export type LocaleParams = s.infer<typeof LocaleParams>;
