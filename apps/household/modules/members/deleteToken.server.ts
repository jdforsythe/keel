import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { denied } from "./denied.ts";
import { members } from "./members.contract.ts";
import { membersDb } from "./membersDb.server.ts";
import { tokensOf } from "./tokensOf.server.ts";

/** DELETE on `members.revoke`: removes one of the member's own tokens, which then works nowhere; answers the list. */
export const deleteToken = action(members, "members.revoke", {}, async (_body, { params, user }, ctx) => {
  if (user === "") return err(denied);
  const gone = await membersDb(ctx).run(
    sql(NoRows)`delete from api_tokens where id = ${params.id} and user_id = ${user}`,
  );
  if (!gone.ok) return err(gone.error);
  const list = await tokensOf(user, ctx);
  return list.ok ? ok({ tokens: list.value }) : err(list.error);
});
