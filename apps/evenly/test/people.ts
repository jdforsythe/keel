import type { Ctx } from "@keel/ctx";

/** People of the trip with ids from `ctx`, as a test builds them. */
export default function people(ctx: Ctx, names: readonly string[]) {
  return names.map((name) => ({ id: ctx.random.id("Person"), name }));
}
