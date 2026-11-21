import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { SetupData } from "./SetupData.schema.ts";
import { householdStores } from "./householdStores.ts";
import { setup } from "./setup.contract.ts";

export const loadSetup = loader(
  setup,
  "setup.form",
  { output: SetupData, stores: householdStores },
  async ({ stores }) =>
    ok({
      heading: "Set up your household",
      intro: "Name the household once. The list and the receipts book open after that.",
      name: "Household name",
      save: "Save",
      current: stores.household.get("name"),
      done: "The household is set up. Open the list or the receipts book from the start page.",
    }),
);
