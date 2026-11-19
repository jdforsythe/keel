import { module } from "@keel/compiler";

export default module({
  id: "recipes",
  deps: [
    "kitchen",
    "@keel/std-brands",
    "@keel/std-i18n",
    "@keel/std-money",
    "@keel/std-temporal",
    "@keel/std-text",
    "@keel/std-messages",
  ],
  capabilities: ["net", "storage"],
  public: {
    exports: ["RecipeParams", "RecipeSearch"],
    routes: [],
  },
});
