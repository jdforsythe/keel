import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { MemberRow } from "./MemberRow.schema.ts";
import { ProfileData } from "./ProfileData.schema.ts";
import { denied } from "./denied.ts";
import { members } from "./members.contract.ts";
import { membersDb } from "./membersDb.server.ts";
import { profileText } from "./profileText.ts";
import { tokensOf } from "./tokensOf.server.ts";

/** The profile page: the signed-in member's row, which their first sign-in made, and their working tokens. */
export const loadProfile = loader(members, "members.profile", { output: ProfileData }, async ({ user }, ctx) => {
  if (user === "") return err(denied);
  const row = await membersDb(ctx).one(sql(MemberRow)`select email, name, phone from members where user_id = ${user}`);
  if (!row.ok) return err(row.error.code === "keel.notFound" ? denied : row.error);
  const list = await tokensOf(user, ctx);
  if (!list.ok) return err(list.error);
  const { email, name, phone } = row.value;
  return ok({ text: profileText, email, name, ...(phone === null ? {} : { phone }), tokens: list.value });
});
