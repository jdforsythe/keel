import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { Profile } from "./Profile.schema.ts";
import { denied } from "./denied.ts";
import { members } from "./members.contract.ts";
import { membersDb } from "./membersDb.server.ts";

/** POST on the profile page: saves the member's name and phone, then shows the page again marked saved. */
export const saveProfile = action(members, "members.profile", { input: Profile }, async (input, { user }, ctx) => {
  if (user === "") return err(denied);
  const saved = await membersDb(ctx).run(
    sql(NoRows)`update members set name = ${input.name}, phone = ${input.phone ?? null} where user_id = ${user}`,
  );
  return saved.ok ? ok(members.href("members.profile", {}, { saved: true })) : err(saved.error);
});
