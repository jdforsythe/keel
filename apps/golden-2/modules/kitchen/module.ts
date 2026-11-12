import { module } from "@keel/compiler";

export default module({
  id: "kitchen",
  deps: ["@keel/std-money", "@keel/std-temporal", "@keel/std-text"],
  capabilities: ["clock", "random", "storage"],
  public: {
    exports: ["Recipe", "Box", "RecipeDraft", "RecipeRef", "Nothing"],
    routes: ["kitchen.recipes", "kitchen.favorite"],
  },
});
