import { action } from "@keel/router";
import { err, ok, reveal } from "@keel/schema";
import { credentials } from "@keel/std-credentials/server";
import { tx } from "@keel/store";
import { MintedToken } from "./MintedToken.schema.ts";
import { TokenRequest } from "./TokenRequest.schema.ts";
import { accountStores } from "./accountStores.ts";

/** How long a minted token lasts: 30 days in milliseconds. */
const TTL = 30 * 24 * 60 * 60 * 1000;

/**
 * POST on `accounts.tokens`: mints a token for the signed-in caller and stores its id and digest. The answer is the
 * one place the token text leaves; a caller with no session is `keel.denied`.
 */
export const postToken = action(
  { input: TokenRequest, output: MintedToken, stores: accountStores },
  (_input, { caller, stores }, ctx) => {
    const session = stores.sessions.get("sessions").find((x) => x.caller === caller);
    if (caller === "" || session === undefined) {
      return err({ code: "keel.denied", message: "Sign in first", data: null });
    }
    const minted = credentials(ctx).mint({ ttl: TTL });
    if (!minted.ok) return err(minted.error);
    const { token, id, digest, expiresAt } = minted.value;
    const added = tx(stores.addToken, { id, digest, userId: session.userId }, { meta: { caller } });
    return added.ok ? ok({ token: reveal(token), id, expiresAt }) : err(added.error);
  },
);
