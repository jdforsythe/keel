import { loader } from "@keel/router";
import { attempt, err, ok } from "@keel/schema";
import { Me } from "./Me.schema.ts";
import { authOf } from "./authOf.server.ts";

const denied = { code: "keel.denied", message: "Sign in first", data: null };

/**
 * GET on `accounts.me`: the email of the request's `user`, whether a session cookie or an API token said who it is
 * (`identity.server.ts`). No user is `keel.denied`; the email is read from the sign-in library's database.
 */
export const loadMe = loader({ output: Me }, async ({ user }, ctx) => {
  if (user === "") return err(denied);
  const auth = await authOf(ctx);
  if (!auth.ok) return err(auth.error);
  const found = await attempt(async () => (await auth.value.$context).internalAdapter.findUserById(user));
  if (!found.ok) return err(found.error);
  return found.value === null ? err(denied) : ok({ email: found.value.email });
});
