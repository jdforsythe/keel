import { loader } from "@keel/router";
import { err, ok } from "@keel/schema";
import { denied } from "./denied.ts";
import { members } from "./members.contract.ts";
import { tokensOf } from "./tokensOf.server.ts";

/** GET on `members.tokens`: the signed-in member's working tokens. */
export const getTokens = loader(members, "members.tokens", {}, async ({ user }, ctx) => {
  if (user === "") return err(denied);
  const list = await tokensOf(user, ctx);
  return list.ok ? ok({ tokens: list.value }) : err(list.error);
});
