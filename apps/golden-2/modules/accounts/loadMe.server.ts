import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { accounts } from "./accounts.contract.ts";
import { profileStores } from "./profileStores.ts";

const denied = { code: "keel.denied", message: "Sign in first", data: null };

/**
 * GET on `accounts.me`: the email of the request's `user`, whether a session cookie or an API token said who it is
 * (`identity.server.ts`), from the profile the last sign-in saved. No user, or none with a profile, is `keel.denied`.
 */
export const loadMe = loader(accounts, "accounts.me", { stores: profileStores }, async ({ user, stores }) => {
  const profile = user === "" ? undefined : stores.profiles.get("profiles").find((p) => p.userId === user);
  return profile === undefined ? err(denied) : ok({ email: profile.email });
});
