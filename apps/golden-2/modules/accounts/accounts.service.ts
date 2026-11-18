import { endpoints } from "@keel/services";
import { ErrorReply } from "./ErrorReply.schema.ts";
import { Me } from "./Me.schema.ts";
import { MintedToken } from "./MintedToken.schema.ts";
import { TokenRequest } from "./TokenRequest.schema.ts";

/** The `accounts` API routes: `mint` answers a new token for the signed-in user, `me` the request user's email. */
export const accounts = endpoints({
  mint: { method: "POST", path: "/api/tokens", body: TokenRequest, output: MintedToken, errors: { 403: ErrorReply } },
  me: { method: "GET", path: "/api/me", output: Me, errors: { 403: ErrorReply } },
});
