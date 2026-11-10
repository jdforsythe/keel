import { s } from "@keel/schema";
import { messages } from "@keel/std-messages";
import { AppLocale } from "./AppLocale.schema.ts";

/** Every string the recipes screens show, one file per locale in `RecipesText/`. */
export const RecipesText = messages(
  AppLocale,
  {
    mark: {},
    tagline: {},
    home: {},
    newLink: {},
    listTitle: {},
    filterAll: {},
    filterFavorites: {},
    count: { n: s.int({ min: 0 }) },
    empty: {},
    recipeHeading: {},
    favorite: {},
    notFavorite: {},
    toggleFavorite: {},
    addedOn: { date: s.string() },
    newHeading: {},
    titleLabel: {},
    minutesLabel: {},
    amountLabel: {},
    currencyLabel: {},
    save: {},
    titleRule: {},
    minutesRule: {},
    amountRule: {},
    currencyRule: {},
    otherRule: {},
    titleTaken: {},
    notFound: { id: s.string() },
    indexTitle: {},
    showTitle: { title: s.string() },
    newTitle: {},
  },
  (locale) => import(`./RecipesText/${locale}.ts`),
);

export type RecipesText = s.infer<typeof RecipesText>;
