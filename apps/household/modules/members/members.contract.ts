import { contract } from "@keel/router/contract";
import { ErrorReply } from "./ErrorReply.schema.ts";
import { MintedToken } from "./MintedToken.schema.ts";
import { ProfileSearch } from "./ProfileSearch.schema.ts";
import { SignSearch } from "./SignSearch.schema.ts";
import { TokenList } from "./TokenList.schema.ts";
import { TokenRef } from "./TokenRef.schema.ts";
import { TokenRequest } from "./TokenRequest.schema.ts";

/** The frame around the members pages, the sign-in and sign-up pages, the member's profile, and the member's API tokens. */
export const members = contract("members", {
  "members.shell": { layout: true },
  "members.signin": { path: "/signin", search: SignSearch },
  "members.signup": { path: "/signup", search: SignSearch },
  "members.profile": { path: "/profile", search: ProfileSearch },
  "members.tokens": { method: "GET", path: "/api/tokens", output: TokenList, errors: { 403: ErrorReply } },
  "members.mint": {
    method: "POST",
    path: "/api/tokens",
    body: TokenRequest,
    output: MintedToken,
    errors: { 403: ErrorReply },
  },
  "members.revoke": {
    method: "DELETE",
    path: "/api/tokens/:id",
    params: TokenRef,
    output: TokenList,
    errors: { 403: ErrorReply },
  },
});
