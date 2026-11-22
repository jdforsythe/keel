import type { Ctx } from "@keel/ctx";
import { sql } from "@keel/std-postgres";
import { tokens } from "@keel/std-tokens/server";
import { BearerToken } from "./BearerToken.schema.ts";
import { TokenRow } from "./TokenRow.schema.ts";
import { membersDb } from "./membersDb.server.ts";

/** `Bearer <token>`, the token as an API route's `bearer` reads it. */
const BEARER = /^Bearer ([A-Za-z0-9\-._~+/]{1,4096}=*)$/i;

/**
 * The member an `authorization` header's API token acts for: the token's id (`idOf`) picks its row in `api_tokens`,
 * then `check` compares the token with that row's digest and expiry. `''` for another scheme, an unknown, revoked,
 * tampered or expired token, or a database that did not answer.
 */
export async function bearerUser(header: string, ctx: Ctx): Promise<string> {
  const token = BearerToken.parse(BEARER.exec(header)?.[1]);
  if (!token.ok) return "";
  const id = tokens(ctx).idOf(token.value);
  if (!id.ok) return "";
  const rows = await membersDb(ctx).query(
    sql(TokenRow)`select id, digest, user_id as "userId" from api_tokens where id = ${id.value}`,
  );
  if (!rows.ok) return "";
  const found = tokens(ctx).check(token.value, () => rows.value[0]);
  return found.ok ? found.value.userId : "";
}
