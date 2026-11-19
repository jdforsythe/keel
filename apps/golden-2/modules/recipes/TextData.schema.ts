import { s } from "@keel/schema";
import { RecipesText } from "./RecipesText.schema.ts";

/** Loader data of a level that shows only copy: the shell and the new-recipe page. */
export const TextData = s.object({ text: RecipesText });

export type TextData = s.infer<typeof TextData>;
