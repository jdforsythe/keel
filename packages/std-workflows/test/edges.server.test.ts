// std.workflows Store and Rules at their edges: a chart event that takes the name of a workflow transaction, a chart
// file `keel check` reads only as part of the project, and a guarded self target beside a guarded target with no `to`.
// Seed 1337.
import { check } from "@keel/check";
import { ok, s } from "@keel/schema";
import { commitStores } from "@keel/server";
import { chart } from "@keel/std-statecharts";
import "@keel/std-workflows/tools";
import { tx } from "@keel/store";
import fc from "fast-check";
import { parseSync } from "oxc-parser";
import { expect, test } from "vitest";
import { workflow } from "../src/index.server.ts";
import { stepState, undoneStep } from "../src/tools/index.ts";
import { inRoot, nextId, sim } from "./support.server.ts";

const empty = s.object({});

/** A chart whose event `name` sits beside `go`; `idle` moves to `done` on either. */
const named = (name: string) =>
  inRoot(() =>
    chart(nextId("named"), {
      data: s.object({}),
      start: {},
      events: { go: empty, [name]: empty },
      initial: "idle",
      states: { idle: { on: { go: "done", [name]: "done" } }, done: { final: true } },
    }),
  );

const RESERVED = ["start", "attempt", "forget"] as const;

test("A chart event named start, attempt or forget is refused with a diagnostic code", () => {
  fc.assert(
    fc.property(fc.constantFrom(...RESERVED), (name) => {
      const id = nextId("reserved");
      expect(() => inRoot(() => workflow(id, { chart: named(name) }))).toThrow(
        `E2355 workflow ${id}: chart event ${name} takes the name of a workflow transaction; rename it`,
      );
    }),
    { seed: 1337, numRuns: 3 },
  );
});

test("A chart whose events take no transaction name opens its stores", async () => {
  const wf = inRoot(() => workflow(nextId("renamed"), { chart: named("begin") }));
  const r = await commitStores(sim(), wf.stores, (S) => ok(Object.keys(S.events).sort()));
  expect(r).toEqual({ ok: true, value: ["begin", "go"] });
});

const wfHead = `import { workflow } from "@keel/std-workflows"\nimport { removalChart } from "./c.ts"\nimport { purgeList } from "./purgeList.server.ts"\n`;
const wf = `${wfHead}export const removal = workflow('api.removal', { chart: removalChart, steps: { purging: { run: purgeList, done: 'begin', failed: 'stuck' } } })\n`;
const chartFile = {
  path: "modules/api/c.ts",
  source: `import { chart } from "@keel/std-statecharts"
import { s } from "@keel/schema"
export const removalChart = chart('api.removalChart', {
  data: s.object({}), start: {},
  events: { begin: s.object({}), purged: s.object({}), stuck: s.object({ code: s.string() }) },
  initial: 'queued',
  states: { queued: { on: { begin: 'purging' } }, purging: { on: { purged: 'purged', stuck: 'stuck' } }, purged: { final: true }, stuck: { final: true } },
})
`,
};
const purge = {
  path: "modules/api/purgeList.server.ts",
  source: "export const purgeList = async () => ({ ok: true })\n",
};
const flowFile = { path: "modules/api/removal.server.ts", source: wf };
const files = [purge, flowFile];

test("E2352 fires when the chart file is among the checked files", () => {
  const d = check([...files, chartFile], { types: false }).diagnostics.filter((x) => x.code === "E2352");
  expect(d.map((x) => x.path)).toEqual(["modules/api/removal.server.ts"]);
});

test("E2352 fires when the chart file is in the project but not among the checked files", () => {
  // The rule reads the chart from `project`, which holds every code file of the project.
  const d = check(files, { types: false, project: [...files, chartFile] }).diagnostics.filter(
    (x) => x.code === "E2352",
  );
  expect(d.map((x) => x.path)).toEqual(["modules/api/removal.server.ts"]);
});

const sagaChart = {
  path: "modules/api/c.ts",
  source: `import { chart } from "@keel/std-statecharts"
import { s } from "@keel/schema"
export const removalChart = chart('api.sagaChart', {
  data: s.object({}), start: {},
  events: { go: s.object({}), reserved: s.object({}), lost: s.object({ code: s.string() }), charged: s.object({}), declined: s.object({ code: s.string() }) },
  initial: 'queued',
  states: {
    queued: { on: { go: 'reserving' } },
    reserving: { on: { reserved: 'charging', lost: 'gaveUp' } },
    charging: { on: { charged: 'paid', declined: 'refused' } },
    paid: { final: true }, refused: { final: true }, gaveUp: { final: true },
  },
})
`,
};
const sagaFlow = {
  path: "modules/api/removal.server.ts",
  source: `${wfHead}export const removal = workflow('api.removal', { chart: removalChart, steps: { reserving: { run: purgeList, done: 'reserved', failed: 'lost' }, charging: { run: purgeList, done: 'charged', failed: 'declined' } } })\n`,
};

/** What the rule finds on the workflow file when it alone is handed over, its chart file only in `project`. */
const alone = (
  rule: typeof stepState,
  flow: { path: string; source: string },
  chartAt: { path: string; source: string },
) =>
  rule.check({
    file: flow,
    ast: parseSync(flow.path, flow.source, { sourceType: "module", lang: "ts" }).program,
    artifacts: {},
    project: [flow, chartAt],
  });

test("E2352 and W2353 read a chart file that is in the project but not handed over, as when it is checked", () => {
  const cases = [
    { rule: stepState, code: "E2352", flow: flowFile, chartAt: chartFile },
    { rule: undoneStep, code: "W2353", flow: sagaFlow, chartAt: sagaChart },
  ];
  fc.assert(
    fc.property(fc.constantFrom(...cases), fc.boolean(), ({ rule, code, flow, chartAt }, first) => {
      const handed = first ? [chartAt, purge, flow] : [purge, flow, chartAt];
      const checked = check(handed, { types: false }).diagnostics.filter((d) => d.code === code);
      const found = alone(rule, flow, chartAt);
      expect(found.length).toBe(1);
      expect(checked.map((d) => [d.path, d.line, d.col])).toEqual(found.map((f) => [f.path, f.line, f.col]));
      expect(alone(rule, flow, { path: "modules/api/other.ts", source: chartAt.source })).toEqual([]);
    }),
    { seed: 1337, numRuns: 8 },
  );
});

/** A workflow file over a chart file whose event `name` sits beside `go`. */
const reservedFiles = (name: string) => {
  const c = {
    path: "modules/api/c.ts",
    source: `import { chart } from "@keel/std-statecharts"
import { s } from "@keel/schema"
export const removalChart = chart('api.removalChart', {
  data: s.object({}), start: {},
  events: { go: s.object({}), ${name}: s.object({}) },
  initial: 'idle',
  states: { idle: { on: { go: 'done', ${name}: 'done' } }, done: { final: true } },
})
`,
  };
  const w = {
    path: "modules/api/removal.server.ts",
    source: `import { workflow } from "@keel/std-workflows"\nimport { removalChart } from "./c.ts"\nexport const removal = workflow('api.removal', { chart: removalChart })\n`,
  };
  return { c, w };
};
const e2355 = (checked: readonly { path: string; source: string }[], project?: { path: string; source: string }[]) =>
  check(checked, project === undefined ? { types: false } : { types: false, project })
    .diagnostics.filter((d) => d.code === "E2355")
    .map((d) => ({ path: d.path, line: d.line, col: d.col, message: d.message }));

test("E2355 reports each reserved chart event at the workflow's `chart`, and nothing for a renamed twin", () => {
  for (const name of RESERVED) {
    const { c, w } = reservedFiles(name);
    const d = e2355([w, c]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({
      path: w.path,
      line: 3,
      col: (w.source.split("\n")[2]?.indexOf("removalChart }") ?? 0) + 1,
    });
    expect(d[0]?.message).toContain(`'${name}'`);
    const twin = reservedFiles("begin");
    expect(e2355([twin.w, twin.c])).toEqual([]);
  }
});

test("E2355 reads a chart file that is in the project but not among the checked files", () => {
  fc.assert(
    fc.property(fc.constantFrom(...RESERVED), (name) => {
      const { c, w } = reservedFiles(name);
      expect(e2355([w], [w, c])).toEqual(e2355([w, c]));
      expect(e2355([w], [w, c])).toHaveLength(1);
    }),
    { seed: 1337, numRuns: 3 },
  );
});

/** `pick` enters `picking` again when `self` holds, stays when `stay` holds (and `self` does not). */
const guarded = () =>
  inRoot(() =>
    chart(nextId("guarded"), {
      data: s.object({ self: s.boolean(), stay: s.boolean() }),
      start: { self: false, stay: false },
      events: { go: empty, pick: empty, set: s.object({ self: s.boolean(), stay: s.boolean() }), out: empty },
      guards: { self: (d) => d.self, stay: (d) => d.stay },
      actions: { set: (_d, p) => ("self" in p ? { self: p.self, stay: p.stay } : _d) },
      initial: "idle",
      states: {
        idle: { on: { go: "picking" } },
        picking: {
          on: {
            pick: [{ to: "picking", guard: "self" }, { guard: "stay" }],
            set: { do: "set" },
            out: "done",
          },
        },
        done: { final: true },
      },
    }),
  );

async function entered(self: boolean, stay: boolean): Promise<number> {
  const wf = inRoot(() => workflow(nextId("pick"), { chart: guarded() }));
  const r = await commitStores(sim(), wf.stores, (S) => {
    void tx(S.start, { id: "f", data: { self: false, stay: false } });
    void tx(S.events.go, { id: "f", payload: {} });
    void tx(S.events.set, { id: "f", payload: { self, stay } });
    void tx(S.events.pick, { id: "f", payload: {} });
    return ok(S.store.get("instances").f?.entered ?? -1);
  });
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
}

test("A guarded target with no `to` that the chart takes stays in the entry", async () => {
  expect(await entered(false, true)).toBe(1);
  expect(await entered(false, false)).toBe(1);
});

test("A guarded self target the chart takes beside a guarded target with no `to` is an entry", async () => {
  await fc.assert(
    fc.asyncProperty(fc.boolean(), fc.boolean(), async (self, stay) => {
      expect(await entered(self, stay)).toBe(self ? 2 : 1);
    }),
    { seed: 1337, numRuns: 8 },
  );
});
