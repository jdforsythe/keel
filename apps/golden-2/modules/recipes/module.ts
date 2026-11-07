import { module } from "@keel/compiler";

export default module({
  id: "recipes",
  deps: [],
  capabilities: ["net", "storage"],
  public: {
    exports: ["Recipe", "Box", "RecipeDraft", "RecipeParams", "RecipeSearch", "Nothing", "BoxReply"],
    routes: [],
  },
});
