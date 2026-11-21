import { s } from "@keel/schema";

/** The markets the shopping list can point to; each has a name in `RecipesText` and a place in `markets`. */
export const MarketKey = s.enum(["unionSquare", "viktualien", "tsukiji"]);

export type MarketKey = s.infer<typeof MarketKey>;
