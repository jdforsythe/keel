import { module } from "@keel/compiler";

/** The `@keel/std-i18n` library manifest (std.i18n, k.library): a module that formats with its locale tags or plurals lists the package in `deps`. */
export default module({
  id: "i18n",
  deps: [],
  capabilities: [],
  public: {
    exports: [
      "collate",
      "formatDateTime",
      "formatList",
      "formatNumber",
      "formatUnit",
      "Locale",
      "localeName",
      "numberParts",
      "plural",
      "pluralCategories",
      "PluralForms",
    ],
  },
});
