import { action } from "@keel/router";
import { err, ok, reveal } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { tokens } from "@keel/std-tokens/server";
import { dayOf } from "./dayOf.ts";
import { denied } from "./denied.ts";
import { members } from "./members.contract.ts";
import { membersDb } from "./membersDb.server.ts";

const DAY = 24 * 60 * 60 * 1000;

/**
 * POST on `members.mint`: mints a token for the signed-in member that works for `days` days, and keeps its id, digest,
 * member and expiry in `api_tokens`. The answer is the one place the token text leaves. A request that presents a
 * token itself is `keel.denied`: a token never mints another, so its expiry holds.
 */
export const postToken = action(members, "members.mint", {}, async (body, { user, bearer }, ctx) => {
  if (user === "" || bearer !== undefined) return err(denied);
  const minted = tokens(ctx).mint({ ttl: body.days * DAY });
  if (!minted.ok) return err(minted.error);
  const { token, id, digest, expiresAt } = minted.value;
  const ends = expiresAt ?? ctx.clock.now() + body.days * DAY;
  const expiresOn = dayOf(ends);
  if (expiresOn === null) return err({ code: "members.expiry", message: "the expiry is out of range", data: null });
  const added = await membersDb(ctx).run(
    sql(NoRows)`insert into api_tokens (id, digest, user_id, expires_at) values (${id}, ${digest}, ${user}, ${ends})`,
  );
  return added.ok ? ok({ token: reveal(token), id, expiresOn }) : err(added.error);
});
