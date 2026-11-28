import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { ShellData } from "../members/ShellData.schema.ts";
import { shellText } from "../members/shellText.ts";
import { frameStores } from "../setup/frameStores.server.ts";
import { app } from "./app.contract.ts";

/** The frame's data: the masthead's copy, the household's name and whether a member is signed in. */
export const loadFrame = loader(
  app,
  "app.frame",
  { output: ShellData, stores: frameStores },
  async ({ user, stores }) => ok({ text: shellText, name: stores.household.get("name"), signedIn: user !== "" }),
);
