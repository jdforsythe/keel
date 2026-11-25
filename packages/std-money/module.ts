import { module } from "@keel/compiler";

/** The `@keel/std-money` library manifest (std.money, k.library): a module that holds, parses or formats money lists the package in `deps`. */
export default module({
  id: "money",
  deps: ["@keel/std-i18n"],
  capabilities: [],
  public: {
    exports: ["addMoney", "Currency", "formatMoney", "Money", "MoneyError", "ParseMoneyError", "parseMoney"],
  },
});
