import { guard } from "@keel/router";
import { err, ok } from "@keel/schema";
import { meApi } from "./meApi.ts";

/**
 * Sends a page to the sign-in page, with `next` naming it, until the api knows the user. A page in a `client`
 * deployable gets `user` `''`, so the guard asks the api, whose identity source reads the session cookie.
 */
export const signedIn = guard({ redirect: "notes.signin" }, async (_request, ctx) =>
  (await meApi.me({}, ctx)).ok ? ok(null) : err({ code: "keel.denied", message: "sign in first", data: null }),
);
