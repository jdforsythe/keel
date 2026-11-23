import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { writeFor } from "@keel/std-offline";
import { denied } from "../members/denied.ts";
import { markBought } from "./markBought.server.ts";
import { shopping } from "./shopping.contract.ts";

/**
 * `POST /api/items/:id/bought`: the write a list page sends through its outbox. The write commits for the member who
 * queued it: a request no one is signed in for is `offline.signin`, which the outbox holds until that member signs in
 * again, and another member's is `offline.owner`. The route binds no guard, so a signed-out request reaches this
 * check; a request with no member and no owner is denied here.
 */
export const postBought = action(shopping, "shopping.mark", {}, async (body, args, ctx) => {
  const write = writeFor(body.write, args.user);
  if (!write.ok) return err(write.error);
  if (args.user === "") return err(denied);
  const items = await markBought(ctx, args.params.id, body.bought, { ...write.value, owner: args.user });
  return items.ok ? ok({ items: items.value }) : err(items.error);
});
