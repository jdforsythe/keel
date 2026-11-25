import { module } from "@keel/compiler";

export default module({
  id: "recipes",
  deps: [
    "kitchen",
    "@keel/std-brands",
    "@keel/std-geo",
    "@keel/std-headless",
    "@keel/std-i18n",
    "@keel/std-money",
    "@keel/std-temporal",
    "@keel/std-text",
    "@keel/std-messages",
    "@keel/std-tables",
    "@keel/std-timings",
  ],
  capabilities: ["geo.position", "net", "storage"],
  public: {
    exports: ["RecipeParams", "RecipeSearch"],
  },
});
