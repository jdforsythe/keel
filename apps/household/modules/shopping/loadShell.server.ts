import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { ShellData } from "../members/ShellData.schema.ts";
import { shellText } from "../members/shellText.ts";
import { householdStores } from "../setup/householdStores.ts";
import { shopping } from "./shopping.contract.ts";

/** The frame's data: the masthead's copy, the household's name and whether a member is signed in. */
export const loadShell = loader(
  shopping,
  "shopping.shell",
  { output: ShellData, stores: householdStores },
  async ({ user, stores }) => ok({ text: shellText, name: stores.household.get("name"), signedIn: user !== "" }),
);
