import { manifest } from "@keel/router";
import { kitchen } from "./kitchen.contract.ts";
import { loadCatalog } from "./loadCatalog.server.ts";
import { loadCurrencyTally } from "./loadCurrencyTally.server.ts";
import { loadRecipes } from "./loadRecipes.server.ts";
import { postFavorite } from "./postFavorite.server.ts";
import { postRecipe } from "./postRecipe.server.ts";

export const routes = manifest(kitchen, {
  "kitchen.box": { loader: loadRecipes },
  "kitchen.add": { action: postRecipe },
  "kitchen.favorite": { action: postFavorite },
  "kitchen.catalog": { loader: loadCatalog },
  "kitchen.currencyTally": { loader: loadCurrencyTally },
});
