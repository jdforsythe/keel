import { module } from "@keel/compiler";

/** The `@keel/std-headless` library manifest (std.headless, k.library): a module that renders its widgets lists the package in `deps`. */
export default module({
  id: "headless",
  deps: ["@keel/std-statecharts"],
  capabilities: [],
  public: {
    exports: [
      "Combobox",
      "Dialog",
      "Disclosure",
      "Listbox",
      "ListState",
      "listChart",
      "Menu",
      "Option",
      "openChart",
      "optionsChart",
      "stableRows",
      "Tabs",
      "ToastItem",
      "Toaster",
      "toastChart",
    ],
  },
});
