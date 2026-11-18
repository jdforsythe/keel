import type { Ctx } from "@keel/ctx";
import { ok } from "@keel/schema";
import { commitStores } from "@keel/server";
import { credentials } from "@keel/std-credentials/server";
import { BearerToken } from "./BearerToken.schema.ts";
import { tokenStores } from "./tokenStores.ts";

/** `Bearer <token>`, the token as k.server reads an API route's `bearer`. */
const BEARER = /^Bearer ([A-Za-z0-9\-._~+/]{1,4096}=*)$/i;

/**
 * The user an `authorization` header's API token acts for: the token checked with `credentials(ctx).check` against
 * the `accounts.tokens` store, read outside a request (nothing is saved). `''` for another scheme, an unknown token,
 * a tampered one or an expired one.
 */
export async function bearerUser(header: string, ctx: Ctx): Promise<string> {
  const text = BEARER.exec(header)?.[1];
  const token = BearerToken.parse(text);
  if (!token.ok) return "";
  const found = await commitStores(ctx, tokenStores, (st) =>
    ok(credentials(ctx).check(token.value, (id) => st.tokens.get("tokens").find((t) => t.id === id))),
  );
  return found.ok && found.value.ok ? found.value.value.userId : "";
}
