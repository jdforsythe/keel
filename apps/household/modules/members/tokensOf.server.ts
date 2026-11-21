import type { Ctx } from "@keel/ctx";
import { ok } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { TokenExpiry } from "./TokenExpiry.schema.ts";
import { dayOf } from "./dayOf.ts";
import { membersDb } from "./membersDb.server.ts";

/** The tokens of `user` that still work, the one ending first first, each with the day it ends. */
export async function tokensOf(user: string, ctx: Ctx) {
  const rows = await membersDb(ctx).query(
    sql(TokenExpiry)`select id, expires_at as "expiresAt" from api_tokens
                     where user_id = ${user} and expires_at > ${ctx.clock.now()} order by expires_at, id`,
  );
  if (!rows.ok) return rows;
  return ok(
    rows.value.flatMap((r) => {
      const expiresOn = dayOf(r.expiresAt);
      return expiresOn === null ? [] : [{ id: r.id, expiresOn }];
    }),
  );
}
