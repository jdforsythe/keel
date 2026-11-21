import { guard } from "@keel/router";
import { err, ok } from "@keel/schema";

/** Admits a request whose `user` the identity source resolved, from a session cookie or a valid API token; else 403 `keel.denied`. */
export const signedIn = guard({}, async ({ user }) =>
  user === "" ? err({ code: "keel.denied", message: "Sign in first", data: null }) : ok(null),
);
