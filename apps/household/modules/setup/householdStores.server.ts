import { store, transaction } from "@keel/store";
import { Household } from "./Household.schema.ts";
import { SetupForm } from "./SetupForm.schema.ts";

/** The household's name on the server; `null` until someone sets it up. */
export const householdStores = () => {
  const household = store(Household, { name: null }, { id: "setup.household" });
  const name = transaction(household, "setup.household.name", SetupForm, (_state, p) => ({ name: p.name }));
  return { household, name };
};
