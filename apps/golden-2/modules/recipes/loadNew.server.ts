import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { LocaleParams } from "./LocaleParams.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";
import { TextData } from "./TextData.schema.ts";

/** The new-recipe page's copy in its locale. */
export const loadNew = loader({ output: TextData, params: LocaleParams }, async ({ params }) =>
  ok({ text: await RecipesText.load(params.locale) }),
);
