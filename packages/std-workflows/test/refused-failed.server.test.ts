// std.workflows Run: a `failed` commit its event refuses is an `err` that counts a std.jobs attempt, so the next run is
// past `attempts` and commits `failed` `workflows.attempts`; one refused too ends the job in std.jobs `failed` with the
// refusal's code (the `jobs.queue` section), never an instance left in its step state with no trace. A `done` payload
// its event refuses commits `failed` with that code, and cannot strand the instance either. Seed 1337.
import { type KeelError, type Result, err, ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { commitStores } from "@keel/server";
import { queue } from "@keel/std-jobs";
import { chart } from "@keel/std-statecharts";
import { tx } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";
import { flows, workflow } from "../src/index.server.ts";
import { type Data, close, inRoot, nextId, pass, settle, sim } from "./support.server.ts";

const Codes = ["api.nope", "workflows.attempts", "schema.invalid"] as const;
type Code = (typeof Codes)[number];
const DataSchema = s.object({ n: s.int({ min: 0, max: 3 }), freed: s.int({ min: 0, max: 3 }), code: s.string() });
const empty = s.object({});
type Out = Result<{ freed: number }, KeelError<string, unknown>>;

/** The removal chart whose `stuck` payload takes only the codes in `allowed`. */
function flow(allowed: readonly [Code, ...Code[]], run: () => Promise<Out>) {
  const id = nextId("refused");
  const c = inRoot(() =>
    chart(nextId("refusedChart"), {
      data: DataSchema,
      start: { n: 0, freed: 0, code: "" },
      events: {
        begin: empty,
        purged: s.object({ freed: s.int({ min: 0, max: 3 }) }),
        stuck: s.object({ code: s.enum(allowed) }),
      },
      actions: {
        record: (d, p) => ({ ...d, freed: p.freed }),
        fail: (d, p) => ({ ...d, code: p.code }),
      },
      initial: "queued",
      states: {
        queued: { on: { begin: "purging" } },
        purging: { on: { purged: { to: "purged", do: "record" }, stuck: { to: "stuck", do: "fail" } } },
        purged: { final: true },
        stuck: { final: true },
      },
    }),
  );
  const wf = inRoot(() =>
    workflow(id, {
      chart: c,
      steps: { purging: { run, done: "purged", failed: "stuck", attempts: 3 } },
    }),
  );
  return { id, wf, jobs: queue({ ...wf.jobs }) };
}

/** Starts one instance holding a sentinel in `data`, runs 120 s of sim clock, returns its row and `/__keel/inspect`. */
async function runOne(f: ReturnType<typeof flow>) {
  const ctx = sim();
  const app = await createApp({
    topology: topology({ web: { modules: ["api"], adapter: "node" } }),
    ctx,
    mode: "dev",
    runners: { api: [f.jobs, flows(f.jobs, [f.wf])] },
  });
  const id = ctx.random.id("Flow");
  const data: Data = { n: 1, freed: 0, code: "needle-4711" };
  const begun = await commitStores(ctx, f.wf.stores, (S) => {
    expect(tx(S.start, { id, data }).ok).toBe(true);
    expect(tx(S.events.begin, { id, payload: {} }).ok).toBe(true);
    return ok(null);
  });
  expect(begun.ok).toBe(true);
  await settle();
  await pass(ctx, 120_000);
  const r = await commitStores(ctx, f.wf.stores, (S) => ok(structuredClone(S.store.get("instances")[id])));
  const inspect = await (await app.fetch(new Request("http://localhost/__keel/inspect"))).text();
  await close(app);
  return { row: r.ok ? r.value : undefined, inspect };
}

const nope = (code: string): Out => err({ code, message: "no", data: {} });

test("a last-attempt `failed` its event refuses ends the instance in `failed` `workflows.attempts`", async () => {
  let calls = 0;
  const f = flow(["api.nope", "workflows.attempts"], async () => {
    calls++;
    return nope("api.other");
  });
  const { row } = await runOne(f);
  expect(calls).toBe(3);
  expect(row?.state).toBe("stuck");
  expect(row?.data.code).toBe("workflows.attempts");
});

test("a `failed` refusing `workflows.attempts` too ends the step's job in `jobs.queue` failures, with no `data`", async () => {
  const f = flow(["api.nope"], async () => nope("api.other"));
  const { row, inspect } = await runOne(f);
  expect(row?.state).toBe("purging");
  expect(inspect).toContain(`${f.id}.purging`);
  expect(inspect).not.toContain("needle-4711");
  expect(inspect).not.toContain("api.other");
});

test("for generated `done` payloads and `failed` code sets, an instance never stays in its step state untraced", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 9 }),
      fc.subarray([...Codes], { minLength: 1 }),
      async (freed, codes) => {
        const [head, ...rest] = codes;
        if (head === undefined) return;
        const f = flow([head, ...rest], async () => ok({ freed }));
        const { row, inspect } = await runOne(f);
        if (freed <= 3) {
          expect(row?.state).toBe("purged");
          expect(row?.data.freed).toBe(freed);
        } else if (codes.includes("schema.invalid")) {
          expect(row?.state).toBe("stuck");
          expect(row?.data.code).toBe("schema.invalid");
        } else if (codes.includes("workflows.attempts")) {
          expect(row?.state).toBe("stuck");
          expect(row?.data.code).toBe("workflows.attempts");
        } else {
          expect(row?.state).toBe("purging");
          expect(inspect).toContain(`${f.id}.purging`);
        }
        expect(inspect).not.toContain("needle-4711");
      },
    ),
    { seed: 1337, numRuns: 20 },
  );
});
