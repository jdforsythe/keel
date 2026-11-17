import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { credentials } from "@keel/std-credentials/server";
import { Me } from "./Me.schema.ts";
import { accountStores } from "./accountStores.ts";

/** GET on `accounts.me`: the bearer token's account. No token, an unknown one and an expired one are `keel.denied`. */
export const loadMe = loader({ output: Me, stores: accountStores }, async ({ bearer, stores }, ctx) => {
  if (bearer === undefined) return err({ code: "keel.denied", message: "No token", data: null });
  const found = credentials(ctx).check(bearer, (id) => stores.tokens.get("tokens").find((t) => t.id === id));
  if (!found.ok) {
    const message = found.error.code === "credentials.expired" ? "Token expired" : "Unknown token";
    return err({ code: "keel.denied", message, data: null });
  }
  const user = stores.users.get("users").find((u) => u.id === found.value.userId);
  return user === undefined
    ? err({ code: "keel.denied", message: "Unknown token", data: null })
    : ok({ email: user.email });
});
