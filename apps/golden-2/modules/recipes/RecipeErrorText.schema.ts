import type { s } from "@keel/schema";
import { messages } from "@keel/std-messages";
import { AppLocale } from "./AppLocale.schema.ts";

/**
 * The error element's strings, one file per locale in `RecipeErrorText/`: a set of its own, so the error element,
 * which gets no loader data, reads its few strings without shipping the recipes screens' entries.
 */
export const RecipeErrorText = messages(
  AppLocale,
  { notFound: {} },
  (locale) => import(`./RecipeErrorText/${locale}.ts`),
);

export type RecipeErrorText = s.infer<typeof RecipeErrorText>;
