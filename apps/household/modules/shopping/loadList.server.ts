import { loader } from "@keel/router";
import { err, formatLiteral, ok } from "@keel/schema";
import { Slug } from "@keel/std-text";
import { ListData } from "./ListData.schema.ts";
import { listOf } from "./listOf.server.ts";
import { shopping } from "./shopping.contract.ts";

export const loadList = loader(shopping, "shopping.list", { output: ListData }, async (args, ctx) => {
  const items = await listOf(ctx);
  if (!items.ok) return err(items.error);
  return ok({
    items: items.value,
    member: args.user,
    text: {
      heading: "Shopping list",
      addStaple: "Add a staple",
      staples: [
        { key: formatLiteral(Slug, "milk"), text: "Milk" },
        { key: formatLiteral(Slug, "bread"), text: "Bread" },
        { key: formatLiteral(Slug, "eggs"), text: "Eggs" },
        { key: formatLiteral(Slug, "rice"), text: "Rice" },
        { key: formatLiteral(Slug, "apples"), text: "Apples" },
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
      outbox: {
        heading: "Marks not applied",
        waiting: "waiting to send",
        waitingBought: "Bought, waiting to send",
        waitingBack: "Back on the list, waiting to send",
        conflict: "someone at home changed this item while your mark waited",
        gone: "this item is no longer on the list",
        otherMember: "another member made this mark on this device",
        refused: "the server did not take this mark",
        goneItem: "An item",
        mineBought: "Mark it bought",
        mineBack: "Put it back on the list",
        theirs: "Leave it as it is",
        dismiss: "Dismiss",
      },
      live: {
        live: "Live: changes from your household show here",
        connecting: "Connecting: changes from your household show once connected",
        offline: "Offline: this list shows what it held when the connection dropped",
        denied: "Signed out: sign in again to see changes",
      },
    },
  });
});
