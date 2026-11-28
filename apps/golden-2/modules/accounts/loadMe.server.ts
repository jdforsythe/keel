import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { Me } from "./Me.schema.ts";
import { accounts } from "./accounts.contract.ts";
import { accountsDb } from "./accountsDb.server.ts";

const denied = { code: "keel.denied", message: "Sign in first", data: null };

/**
 * GET on `accounts.me`: the email of the request's `user`, whether a session cookie or an API token said who it is
 * (`identity.server.ts`), from the profile the last sign-in saved. No user, or none with a profile, is `keel.denied`.
 */
export const loadMe = loader(accounts, "accounts.me", {}, async ({ user }, ctx) => {
  if (user === "") return err(denied);
  const me = await accountsDb(ctx).one(sql(Me)`select email from profiles where user_id = ${user}`);
  if (me.ok) return ok(me.value);
  return err(me.error.code === "keel.notFound" ? denied : me.error);
});
