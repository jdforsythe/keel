import { s } from "@keel/schema";
import { Recipe } from "./Recipe.schema.ts";

export const Box = s.object({ recipes: s.array(Recipe) });

export type Box = s.infer<typeof Box>;
