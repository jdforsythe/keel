import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { householdStores } from "./householdStores.server.ts";
import { setup } from "./setup.contract.ts";

export const getHousehold = loader(setup, "setup.household", { stores: householdStores }, async ({ stores }) =>
  ok({ name: stores.household.get("name") }),
);
