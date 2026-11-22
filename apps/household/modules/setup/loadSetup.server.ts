import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { restockText } from "../shopping/restockText.ts";
import { runsOf } from "../shopping/runsOf.ts";
import { SetupData } from "./SetupData.schema.ts";
import { frameStores } from "./frameStores.server.ts";
import { setup } from "./setup.contract.ts";

export const loadSetup = loader(setup, "setup.form", { output: SetupData, stores: frameStores }, async ({ stores }) =>
  ok({
    heading: "Set up your household",
    intro: "Name the household once. The list and the receipts book open after that.",
    name: "Household name",
    save: "Save",
    current: stores.household.get("name"),
    done: "The household is set up. Open the list or the receipts book from the start page.",
    restock: restockText,
    runs: runsOf(stores.restock.store.get("instances")),
  }),
);
