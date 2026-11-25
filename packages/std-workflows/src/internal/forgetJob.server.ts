import { ok } from "@keel/schema";
import { commitStores } from "@keel/server";
import { type Job, job } from "@keel/std-jobs";
import { tx } from "@keel/store";
import { FlowInput } from "./FlowInput.schema.ts";
import type { Model } from "./Model.ts";
import { rowOf } from "./rowOf.ts";

/** The `<id>.forget` job (std.workflows Run): removes a final instance `keepMs` after the runner saw it. */
export function forgetJob<S extends string, D>(m: Model<S, D>): Job<FlowInput> {
  return job({ input: FlowInput }, async (input, ctx) => {
    const r = await commitStores(ctx, m.open, (S) => {
      if (rowOf(S, input, (s) => m.finals.has(s)) !== undefined) void tx(S.forget, { id: input.id });
      return ok(null);
    });
    return r.ok ? ok(null) : r;
  });
}
