import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { tx } from "@keel/store";
import { SetupForm } from "./SetupForm.schema.ts";
import { householdStores } from "./householdStores.ts";
import { setup } from "./setup.contract.ts";

export const saveSetup = action(
  setup,
  "setup.form",
  { input: SetupForm, stores: householdStores },
  async (input, { caller, stores }) => {
    const r = tx(stores.name, input, { meta: { caller } });
    return r.ok ? ok(null) : err(r.error);
  },
);
