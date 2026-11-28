import { guard } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";

/** Sends a page to the sign-in page, with `next` naming it, until the identity source knows the member. */
export const signedIn = guard({ redirect: "members.signin" }, async ({ user }) =>
  user === "" ? err(keelError.denied.make({}, "sign in first")) : ok(null),
);
