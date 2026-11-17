import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { credentials } from "@keel/std-credentials/server";
import { tx } from "@keel/store";
import { Credentials } from "./Credentials.schema.ts";
import { accountStores } from "./accountStores.ts";
import { routes } from "./routes.ts";

/** POST on `accounts.signup`: stores the account with its password hashed, then goes to the sign-in page. */
export const submitSignUp = action({ input: Credentials, stores: accountStores }, async (input, { stores }, ctx) => {
  const email = input.email.toLowerCase();
  if (stores.users.get("users").some((u) => u.email.toLowerCase() === email)) {
    return err({ code: "keel.fields", message: "Already signed up", data: { email: "Already signed up" } });
  }
  const hashed = await credentials(ctx).hash(input.password);
  if (!hashed.ok) return err(hashed.error);
  const added = tx(stores.addUser, { id: ctx.random.id("User"), email: input.email, password: hashed.value });
  return added.ok ? ok(routes.href("accounts.signin")) : err(added.error);
});
