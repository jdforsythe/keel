import { guard } from "@keel/router";
import { err, ok } from "@keel/schema";

/** Sends a page to the sign-in page, with `next` naming it, until the identity source knows the user. */
export const signedIn = guard({ redirect: "notes.signin" }, async ({ user }) =>
  user === "" ? err({ code: "keel.denied", message: "sign in first", data: null }) : ok(null),
);
