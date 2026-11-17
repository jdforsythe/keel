import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { credentials } from "@keel/std-credentials/server";
import { tx } from "@keel/store";
import { Credentials } from "./Credentials.schema.ts";
import { accountStores } from "./accountStores.ts";
import { wrongCredentials } from "./wrongCredentials.ts";

/**
 * POST on `accounts.signin`: verifies the password and ties the caller to the account. An unknown email and a wrong
 * password get the same answer; a hash below the current cost is replaced.
 */
export const submitSignIn = action(
  { input: Credentials, stores: accountStores },
  async (input, { caller, stores }, ctx) => {
    const email = input.email.toLowerCase();
    const user = stores.users.get("users").find((u) => u.email.toLowerCase() === email);
    const verified = await credentials(ctx).verify(input.password, user?.password);
    if (!verified.ok) return err(verified.error.code === "credentials.mismatch" ? wrongCredentials : verified.error);
    if (user === undefined) return err(wrongCredentials);
    if (verified.value.rehash) {
      const hashed = await credentials(ctx).hash(input.password);
      if (!hashed.ok) return err(hashed.error);
      const changed = tx(stores.setPassword, { userId: user.id, password: hashed.value });
      if (!changed.ok) return err(changed.error);
    }
    const signed = tx(stores.signIn, { caller, userId: user.id }, { meta: { caller } });
    return signed.ok ? ok(null) : err(signed.error);
  },
);
