import type { Ctx } from "@keel/ctx";
import { type Infer, ok } from "@keel/schema";
import { NoRows, sql } from "@keel/std-postgres";
import type { StepEnv } from "@keel/std-workflows";
import { Item } from "./Item.schema.ts";
import { PutBack } from "./PutBack.schema.ts";
import type { RestockData } from "./RestockData.schema.ts";
import { putBackIn } from "./putBackIn.ts";
import { shoppingDb } from "./shoppingDb.server.ts";
import { writeList } from "./writeList.server.ts";

/**
 * The step of a weekly run: puts the run's next staple back on the list. The list's change and the `restocks` row keyed
 * by the step's `key` commit in one transaction, so a step that runs again after a crash finds its row, changes nothing
 * and answers what the first run did.
 */
export const putBack = (data: Infer<typeof RestockData>, ctx: Ctx, env: StepEnv) =>
  shoppingDb(ctx).transaction(async (t) => {
    const name = data.staples[data.next];
    if (name === undefined) return ok({ putBack: false });
    const done = await t.query(sql(PutBack)`select put_back as "putBack" from restocks where key = ${env.key}`);
    if (!done.ok) return done;
    const [first] = done.value;
    if (first !== undefined) return ok(first);
    const before = await t.query(sql(Item)`select id, name, qty, bought, rev from items order by seq`);
    if (!before.ok) return before;
    const written = await writeList(t, before.value, putBackIn(before.value, { id: ctx.random.id("Item"), name }));
    if (!written.ok) return written;
    const r = await t.run(
      sql(NoRows)`insert into restocks (key, name, put_back) values (${env.key}, ${name}, ${written.value})`,
    );
    return r.ok ? ok({ putBack: written.value }) : r;
  });
