import { action } from "@keel/router";
import { err, ok, reveal } from "@keel/schema";
import { tokens } from "@keel/std-tokens/server";
import { tx } from "@keel/store";
import { accounts } from "./accounts.contract.ts";
import { tokenStores } from "./tokenStores.ts";

/** How long a minted token lasts: 30 days in milliseconds. */
const TTL = 30 * 24 * 60 * 60 * 1000;

/**
 * POST on `accounts.mint`: mints a token for the signed-in `user` and stores its id, digest and that user. The
 * answer is the one place the token text leaves. No user, or a request that presents a token itself, is
 * `keel.denied`: a token never mints another, so its 30 days end.
 */
export const postToken = action(
  accounts,
  "accounts.mint",
  { stores: tokenStores },
  (_body, { user, bearer, stores }, ctx) => {
    if (user === "" || bearer !== undefined) return err({ code: "keel.denied", message: "Sign in first", data: null });
    const minted = tokens(ctx).mint({ ttl: TTL });
    if (!minted.ok) return err(minted.error);
    const { token, id, digest, expiresAt } = minted.value;
    const added = tx(stores.addToken, { id, digest, userId: user });
    return added.ok ? ok({ token: reveal(token), id, expiresAt }) : err(added.error);
  },
);
