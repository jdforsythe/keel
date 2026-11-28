// Spec: k.supervise, clause "A std.jobs job whose `fn` calls `defect('bug')`, throws the string `'s'` or rejects with `undefined`, with `attempts: 2`: the runner runs it twice, the job is then in `failed` with code `jobs.thrown`, each run logs one `supervised jobs.run threw: ` record, a job enqueued after it runs, and the process has no unhandled rejection."
// Seed 1337 (no random input: three fixed throws). Sim clock; the wait between attempts is 1,000 ms (std.jobs run).
// Assumption: `failed` is read from the `jobs.queue` inspector section of dev `/__keel/inspect`, as retry-backoff.test.ts reads it; each throw logs one record `supervised jobs.run threw: <class> #<fingerprint>` and, in dev, a second with text, so the case counts the first form.
import { createCtx } from "@keel/ctx";
import { defect, ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { job, queue } from "@keel/std-jobs";
import { expect, test } from "vitest";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const input = s.object({ n: s.int() });
const FIRST = /^supervised jobs\.run threw: (Defect|Error|value) #[0-9a-f]{8}( at \S+:\d+)?$/;

test("A std.jobs job whose `fn` calls `defect('bug')`, throws the string `'s'` or rejects with `undefined`, with `attempts: 2`: the runner runs it twice, the job is then in `failed` with code `jobs.thrown`, each run logs one `supervised jobs.run threw: ` record, a job enqueued after it runs, and the process has no unhandled rejection", async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => void unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const calls: Record<string, number> = { defect: 0, string: 0, undef: 0, after: 0 };
    const jobs = queue({
      "orders.defect": job({ input, attempts: 2 }, async () => {
        calls.defect = (calls.defect ?? 0) + 1;
        return defect("bug");
      }),
      "orders.string": job({ input, attempts: 2 }, async () => {
        calls.string = (calls.string ?? 0) + 1;
        throw "s";
      }),
      "orders.undef": job({ input, attempts: 2 }, () => {
        calls.undef = (calls.undef ?? 0) + 1;
        return Promise.reject(undefined);
      }),
      "orders.after": job({ input, attempts: 1 }, async () => {
        calls.after = (calls.after ?? 0) + 1;
        return ok(null);
      }),
    });
    const lines: string[] = [];
    const app = await createApp({
      topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
      ctx,
      mode: "dev",
      log: { format: "json", write: (l: string) => void lines.push(l) },
      runners: { orders: [jobs] },
    });
    for (const name of ["orders.defect", "orders.string", "orders.undef"] as const)
      await jobs.enqueue(ctx, name, { n: 1 });
    await settle();
    for (let i = 0; i < 4; i++) {
      ctx.clock.advance(1000);
      await settle();
    }
    expect(calls).toMatchObject({ defect: 2, string: 2, undef: 2 });
    const inspect = await (await app.fetch(new Request("http://localhost/__keel/inspect"))).text();
    expect(inspect).toContain("jobs.thrown");
    for (const name of ["orders.defect", "orders.string", "orders.undef"]) expect(inspect).toContain(name);
    const supervised = lines.flatMap((l) => {
      const v: unknown = JSON.parse(l);
      const m = typeof v === "object" && v !== null ? Reflect.get(v, "message") : undefined;
      return typeof m === "string" && FIRST.test(m) ? [m] : [];
    });
    expect(supervised).toHaveLength(6);
    await jobs.enqueue(ctx, "orders.after", { n: 1 });
    await settle();
    expect(calls.after).toBe(1);
    await settle();
    expect(unhandled).toEqual([]);
    await app.close?.();
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});
