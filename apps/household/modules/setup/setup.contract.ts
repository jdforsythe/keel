import { contract } from "@keel/router/contract";
import { Household } from "./Household.schema.ts";
import { SetupSearch } from "./SetupSearch.schema.ts";

export const setup = contract("setup", {
  "setup.form": { path: "/setup", search: SetupSearch },
  "setup.household": { method: "GET", path: "/api/household", output: Household },
});
