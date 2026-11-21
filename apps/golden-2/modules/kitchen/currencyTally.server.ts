import { inspector } from "@keel/compiler/inspect/inspector";
import type { Ctx } from "@keel/ctx";
import { Tally, tallyOf } from "@keel/std-report";
import type { Recipe } from "./Recipe.schema.ts";

const ID = "kitchen.box.currency";

/** The tally of the box as each server last read it, by its storage. */
const tallies = new WeakMap<Ctx["storage"], Tally>();

inspector({ id: ID, schema: Tally, read: (ctx) => tallies.get(ctx.storage) ?? tallyOf(ID, []) });

/**
 * Count the box's recipes by the currency of their price and keep the tally for the dev inspect document, where it
 * is the section `kitchen.box.currency` that `keel report` prints.
 */
export function currencyTally(ctx: Ctx, recipes: readonly Recipe[]): Tally {
  const tally = tallyOf(
    ID,
    recipes.map((r) => r.price.currency),
  );
  tallies.set(ctx.storage, tally);
  return tally;
}
