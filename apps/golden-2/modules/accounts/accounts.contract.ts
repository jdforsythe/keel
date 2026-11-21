import { contract } from "@keel/router/contract";
import { AccountsParams } from "./AccountsParams.schema.ts";
import { AccountsSearch } from "./AccountsSearch.schema.ts";
import { ErrorReply } from "./ErrorReply.schema.ts";
import { Me } from "./Me.schema.ts";
import { MintedToken } from "./MintedToken.schema.ts";
import { TokenRequest } from "./TokenRequest.schema.ts";

/** The accounts module's routes: the sign-up and sign-in pages, `mint` a token for the signed-in user, `me` the request user's email. */
export const accounts = contract("accounts", {
  "accounts.signup": { path: "/:locale/account/signup", params: AccountsParams, search: AccountsSearch },
  "accounts.signin": { path: "/:locale/account/signin", params: AccountsParams, search: AccountsSearch },
  "accounts.mint": {
    method: "POST",
    path: "/api/tokens",
    body: TokenRequest,
    output: MintedToken,
    errors: { 403: ErrorReply },
  },
  "accounts.me": { method: "GET", path: "/api/me", output: Me, errors: { 403: ErrorReply } },
});
