import type { Ctx } from "@keel/ctx";
import { type Id, type KeelError, type Result, defect, err, keelError, ok, pathToString } from "@keel/schema";
import type { EnqueueOptions } from "../EnqueueOptions.ts";
import type { JobTable } from "../JobTable.ts";
import { chanOf } from "./chanOf.ts";
import { transact } from "./transact.ts";
import { wake } from "./wake.ts";

/**
 * `queue.enqueue` (std.jobs): parse `input` (fail: `keel.fields` with `{ [path]: rule }`), then store the job unless
 * `key` matches a pending job or one of the last 1,000 finished, whose id it returns instead.
 */
export async function enqueue(
  ctx: Ctx,
  module: string,
  table: JobTable,
  id: string,
  input: unknown,
  opts: EnqueueOptions,
): Promise<Result<Id<"Job">, KeelError<string, unknown>>> {
  const j = table[id];
  if (j === undefined) defect("std.jobs: no such job in this queue", { data: { job: id } });
  const r = j.input.parse(input);
  if (!r.ok) {
    const data = Object.fromEntries(r.error.data.issues.map((i) => [pathToString(i.path), i.rule]));
    return err(keelError.fields.make(data));
  }
  const job = {
    id: ctx.random.id("Job"),
    job: id,
    input: j.input.encode(r.value),
    at: ctx.clock.now() + (opts.delayMs ?? 0),
    n: 0,
    l: 0,
  };
  const k = opts.key;
  const got = await transact(ctx, module, (st) => {
    const hit = k === undefined ? undefined : (st.q.find((x) => x.key === k) ?? st.done.find((x) => x.k === k));
    if (hit !== undefined) return hit.id;
    st.q.push(k === undefined ? job : { ...job, key: k });
    return job.id;
  });
  wake(chanOf(ctx.storage, `std.jobs.${module}`));
  return ok(got);
}
