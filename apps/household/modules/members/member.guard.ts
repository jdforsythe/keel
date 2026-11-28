import { guard } from "@keel/router";
import { err, keelError, ok } from "@keel/schema";

/** Admits an API request from a member, signed in by cookie or by an API token; else 403 `keel.denied`. */
export const member = guard({}, async ({ user }) =>
  user === "" ? err(keelError.denied.make({}, "sign in first")) : ok(null),
);
