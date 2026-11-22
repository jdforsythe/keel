import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { restockText } from "../shopping/restockText.ts";
import { shoppingApi } from "../shopping/shoppingApi.ts";
import { SetupData } from "./SetupData.schema.ts";
import { householdStores } from "./householdStores.ts";
import { setup } from "./setup.contract.ts";

export const loadSetup = loader(
  setup,
  "setup.form",
  { output: SetupData, stores: householdStores },
  async ({ stores, user }, ctx) => {
    // The weekly runs are the shopping module's: asked through its API, in process, as the signed-in member.
    const runs = await shoppingApi.runs({ user }, ctx);
    if (!runs.ok) return err(runs.error);
    return ok({
      heading: "Set up your household",
      intro: "Name the household once. The list and the receipts book open after that.",
      name: "Household name",
      save: "Save",
      current: stores.household.get("name"),
      done: "The household is set up. Open the list or the receipts book from the start page.",
      restock: restockText,
      runs: runs.value,
    });
  },
);
