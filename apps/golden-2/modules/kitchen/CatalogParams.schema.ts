import { s } from "@keel/schema";
import { Locale } from "@keel/std-i18n";

/** The api's catalog params: the locale whose collation sorts and searches the titles. */
export const CatalogParams = s.object({ locale: Locale });

export type CatalogParams = s.infer<typeof CatalogParams>;
