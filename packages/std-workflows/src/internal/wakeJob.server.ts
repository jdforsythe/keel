import { ok } from "@keel/schema";
import { commitStores } from "@keel/server";
import { type Job, job } from "@keel/std-jobs";
import { tx } from "@keel/store";
import { FlowInput } from "./FlowInput.schema.ts";
import type { Model } from "./Model.ts";
import { rowOf } from "./rowOf.ts";

/** The `<id>.wake` job (std.workflows Run): commits the wait's event if the instance is still in that wait's entry. */
export function wakeJob<S extends string, D>(m: Model<S, D>): Job<FlowInput> {
  return job({ input: FlowInput }, async (input, ctx) => {
    const r = await commitStores(ctx, m.open, (S) => {
      const row = rowOf(S, input, (s) => m.waits.has(s));
      const t = row === undefined ? undefined : S.events[m.waits.get(row.state)?.event ?? ""];
      if (t !== undefined) void tx(t, { id: input.id, payload: {} });
      return ok(null);
    });
    return r.ok ? ok(null) : r;
  });
}
