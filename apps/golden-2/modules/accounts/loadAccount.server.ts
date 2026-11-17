import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { SignedIn } from "./SignedIn.schema.ts";
import { accountStores } from "./accountStores.ts";

/** The email the caller is signed in as, read from its session; none before a sign-in. */
export const loadAccount = loader({ output: SignedIn, stores: accountStores }, async ({ caller, stores }) => {
  const session = stores.sessions.get("sessions").find((x) => x.caller === caller);
  const user = stores.users.get("users").find((u) => u.id === session?.userId);
  return ok(user === undefined ? {} : { email: user.email });
});
