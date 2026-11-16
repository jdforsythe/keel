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
import { nextId, sim } from "../conformance/fixtures.ts";
import { workflow } from "../src/index.ts";
import { stepState, undoneStep } from "../src/tools/index.ts";

const empty = s.object({});

/** A chart whose event `name` sits beside `go`; `idle` moves to `done` on either. */
const named = (name: string) =>
  chart(nextId("named"), {
    data: s.object({}),
    start: {},
    events: { go: empty, [name]: empty },
    initial: "idle",
    states: { idle: { on: { go: "done", [name]: "done" } }, done: { final: true } },
  });

/** What opening the stores of a workflow over `named(name)` throws, or "" when it opens. */
async function opened(name: string): Promise<string> {
  const wf = workflow(nextId("reserved"), { chart: named(name) });
  try {
    await commitStores(sim(), wf.stores, () => ok(null));
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

test.fails("A chart event named start, attempt or forget is refused with a diagnostic code", async () => {
  // no code covers this case yet: the store throws its own uncoded taken-name error
  await fc.assert(
    fc.asyncProperty(fc.constantFrom("start", "attempt", "forget"), async (name) => {
      expect(await opened(name)).toMatch(/^E\d{4} /);
    }),
    { seed: 1337, numRuns: 3 },
  );
});

test("A chart event named start, attempt or forget makes stores(ctx) throw a taken name", async () => {
  for (const name of ["start", "attempt", "forget"]) expect(await opened(name)).toMatch(/taken/);
  expect(await opened("other")).toBe("");
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

/** `pick` enters `picking` again when `self` holds, stays when `stay` holds (and `self` does not). */
const guarded = () =>
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
  });

async function entered(self: boolean, stay: boolean): Promise<number> {
  const wf = workflow(nextId("pick"), { chart: guarded() });
  const r = await commitStores(sim(), wf.stores, (S) => {
    tx(S.start, { id: "f", data: { self: false, stay: false } });
    tx(S.events.go, { id: "f", payload: {} });
    tx(S.events.set, { id: "f", payload: { self, stay } });
    tx(S.events.pick, { id: "f", payload: {} });
    return ok(S.store.get("instances").f?.entered ?? -1);
  });
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
}

test("A guarded target with no `to` that the chart takes stays in the entry", async () => {
  expect(await entered(false, true)).toBe(1);
  expect(await entered(false, false)).toBe(1);
});

test.fails("A guarded self target the chart takes beside a guarded target with no `to` is an entry", async () => {
  // the chart reports neither which target it took nor its guards, so the two read alike
  await fc.assert(
    fc.asyncProperty(fc.boolean(), async (stay) => {
      expect(await entered(true, stay)).toBe(2);
    }),
    { seed: 1337, numRuns: 2 },
  );
});
