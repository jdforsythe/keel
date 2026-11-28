import { loader } from "@keel/router";
import { AccountData } from "./AccountData.schema.ts";
import { accounts } from "./accounts.contract.ts";
import { readAccount } from "./readAccount.server.ts";

/** The `accounts.signin` page's copy and the email the request is signed in as (`readAccount`). */
export const loadSignin = loader(accounts, "accounts.signin", { output: AccountData }, ({ params, user }, ctx) =>
  readAccount(params, user, ctx),
);
