import { s } from "@keel/schema";
import { AppLocale } from "./AppLocale.schema.ts";

/** No recipe has the id a page asked for: the page's locale, so the error element says so in it; never the id. */
export const RecipeNotFound = s.error("recipes.notFound", s.object({ locale: AppLocale }));
