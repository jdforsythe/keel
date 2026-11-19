import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { LocaleParams } from "./LocaleParams.schema.ts";
import { RecipesText } from "./RecipesText.schema.ts";
import { TextData } from "./TextData.schema.ts";

/** The shell's copy in the matched route's locale; a layout declares no params, so it parses them here. */
export const loadShell = loader({ output: TextData }, async ({ params }) => {
  const p = LocaleParams.parse(params);
  if (!p.ok) return err(p.error);
  return ok({ text: await RecipesText.load(p.value.locale) });
});
