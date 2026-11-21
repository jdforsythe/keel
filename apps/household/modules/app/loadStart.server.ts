import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { StartData } from "./StartData.schema.ts";
import { app } from "./app.contract.ts";

export const loadStart = loader(app, "app.start", { output: StartData }, async () =>
  ok({
    heading: "Household",
    intro: "One shopping list and one receipts book for everyone at home.",
    toList: "Open the shopping list",
    toReceipts: "Open the receipts book",
  }),
);
