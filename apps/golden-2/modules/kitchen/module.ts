import { module } from "@keel/compiler";

export default module({
  id: "kitchen",
  deps: [
    "@keel/std-health",
    "@keel/std-i18n",
    "@keel/std-money",
    "@keel/std-tables",
    "@keel/std-temporal",
    "@keel/std-text",
  ],
  capabilities: ["clock", "random", "storage"],
  public: {
    exports: [
      "Recipe",
      "Box",
      "RecipeDraft",
      "RecipeRef",
      "Nothing",
      "CatalogRow",
      "CatalogResult",
      "CatalogParams",
      "CatalogSearch",
      "catalogColumns",
    ],
    routes: ["kitchen.recipes", "kitchen.favorite", "kitchen.catalog"],
  },
});
