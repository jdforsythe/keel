import type { Ctx } from "@keel/ctx";
import { ok } from "@keel/schema";
import type { AccountsParams } from "./AccountsParams.schema.ts";
import { AccountsText } from "./AccountsText.schema.ts";
import { accountsApi } from "./accountsApi.ts";

/**
 * An account page's copy in its locale and the email the request is signed in as, asked of `/api/me` so the page
 * works wherever it is placed: on a `node` deployable the call carries `user`; in a browser `user` is `''` and the
 * call carries the browser's own cookie.
 */
export async function readAccount(params: AccountsParams, user: string, ctx: Ctx) {
  const text = await AccountsText.load(params.locale);
  const me = await accountsApi.me(user === "" ? {} : { user }, ctx);
  return ok(me.ok ? { text, email: me.value.email } : { text });
}
