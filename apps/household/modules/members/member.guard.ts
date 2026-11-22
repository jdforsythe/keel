import { guard } from "@keel/router";
import { err, ok } from "@keel/schema";

/** Admits an API request from a member, signed in by cookie or by an API token; else 403 `keel.denied`. */
export const member = guard({}, async ({ user }) =>
  user === "" ? err({ code: "keel.denied", message: "sign in first", data: null }) : ok(null),
);
