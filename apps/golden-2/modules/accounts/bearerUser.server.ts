import type { Ctx } from "@keel/ctx";
import { sql } from "@keel/std-postgres";
import { tokens } from "@keel/std-tokens/server";
import { ApiToken } from "./ApiToken.schema.ts";
import { BearerToken } from "./BearerToken.schema.ts";
import { accountsDb } from "./accountsDb.server.ts";

/** `Bearer <token>`, the token as k.server reads an API route's `bearer`. */
const BEARER = /^Bearer ([A-Za-z0-9\-._~+/]{1,4096}=*)$/i;

/**
 * The user an `authorization` header's API token acts for: the token's id (`idOf`) picks its row in `api_tokens`,
 * then `check` compares the token with that row's digest and expiry. `''` for another scheme, an unknown token, a
 * tampered one, an expired one or a database that did not answer.
 */
export async function bearerUser(header: string, ctx: Ctx): Promise<string> {
  const text = BEARER.exec(header)?.[1];
  const token = BearerToken.parse(text);
  if (!token.ok) return "";
  const id = tokens(ctx).idOf(token.value);
  if (!id.ok) return "";
  const rows = await accountsDb(ctx).query(
    sql(ApiToken)`select id, digest, user_id as "userId" from api_tokens where id = ${id.value}`,
  );
  if (!rows.ok) return "";
  const found = tokens(ctx).check(token.value, () => rows.value[0]);
  return found.ok ? found.value.userId : "";
}
