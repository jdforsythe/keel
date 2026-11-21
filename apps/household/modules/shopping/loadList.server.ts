import { loader } from "@keel/router";
import { ok, s } from "@keel/schema";
import { ListText } from "./ListText.schema.ts";
import { shopping } from "./shopping.contract.ts";

export const loadList = loader(shopping, "shopping.list", { output: s.object({ text: ListText }) }, async () =>
  ok({
    text: {
      heading: "Shopping list",
      addStaple: "Add a staple",
      staples: [
        { key: "milk", text: "Milk" },
        { key: "bread", text: "Bread" },
        { key: "eggs", text: "Eggs" },
        { key: "rice", text: "Rice" },
        { key: "apples", text: "Apples" },
      ],
      views: "Which items",
      toBuy: "To buy",
      bought: "Bought",
      markBought: "Bought",
      putBack: "Back on the list",
      remove: "Remove",
      empty: "The list is empty. Add a staple to start it.",
      help: "How the list works",
      helpBody: "Adding a name already on the list raises its quantity. Bought items move to the Bought tab.",
      failed: "That change did not apply. Try it again.",
      dismiss: "Dismiss",
    },
  }),
);
