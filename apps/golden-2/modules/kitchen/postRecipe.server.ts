import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import { constraintOf } from "@keel/std-postgres/server";
import { UTC, instantOf, plainDateOf } from "@keel/std-temporal";
import { kitchen } from "./kitchen.contract.ts";
import { kitchenDb } from "./kitchenDb.server.ts";

const taken = { code: "keel.fields", message: "Already in the box", data: { title: "Already in the box" } };

/**
 * Adds a draft dated today in UTC. A title already in the box (ignoring case) is a `keel.fields` error on `title`:
 * the table's unique index decides, so two posts of one title never both land.
 */
export const postRecipe = action(kitchen, "kitchen.add", {}, async (body, _args, ctx) => {
  const now = instantOf(ctx.clock.now());
  if (!now.ok) return err(now.error);
  const added = await kitchenDb(ctx).run(sql(NoRows)`
    insert into recipes (id, title, minutes, price_amount, price_currency, added_on)
    values (${ctx.random.id("Recipe")}, ${body.title}, ${body.minutes}, ${body.price.amount},
            ${body.price.currency}, ${plainDateOf(now.value, UTC)})`);
  if (added.ok) return ok({});
  const dup =
    added.error.code === "postgres.constraint" && constraintOf(added.error, ["recipes_title_key"]) !== undefined;
  return err(dup ? taken : added.error);
});
