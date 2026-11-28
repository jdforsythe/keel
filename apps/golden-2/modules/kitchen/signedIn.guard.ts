import { guard } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";

/** Admits a request whose `user` the identity source resolved, from a session cookie or a valid API token; else 403 `keel.denied`. */
export const signedIn = guard({}, async ({ user }) =>
  user === "" ? err(keelError.denied.make({}, "Sign in first")) : ok(null),
);
