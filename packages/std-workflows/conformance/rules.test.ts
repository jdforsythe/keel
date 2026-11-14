// Spec: std.workflows, Conformance "E2351, E2352, W2353 and E2354 each fire on a fixture and not on its clean twin; `workflow` throws E2352."
// Spec: std.workflows, rule E2351: a `workflow` outside `*.server.ts`, or an id not prefixed by its module (fix prefixes it).
// Spec: std.workflows, rule E2352: a step or wait naming no state or a final state, or whose `done`, `failed` or wait event is not in that state's `on` (no fix; `workflow` throws it).
// Spec: std.workflows, rule W2353: a step's `failed` target is final while another step's `done` lies on a path to it, so its effect is never undone (names both).
// Spec: std.workflows, rule E2354: a module whose `queue` lacks a workflow's `jobs` or whose `runners` lack its `flows` (fix adds them).
// Seed: 1337.
// Assumption: as for std.jobs E2501, `check()` imports nothing, so the rules register by importing `@keel/std-workflows/tools`;
// a module is the files under `modules/<id>/` with a `module.ts` listing `deps`; the workflow file is `modules/api/removal.server.ts`, the chart file `modules/api/removalChart.ts`.
// Assumption: a diagnostic's JSON holds the step names it names (W2353 "names both"); the fix field is a git patch, as for the other rules.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import { ok } from "@keel/schema";
import { workflow } from "@keel/std-workflows";
import "@keel/std-workflows/tools";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { nextId, removalChart } from "./fixtures.ts";

type Files = Parameters<typeof check>[0];
const manifest = `import { module } from "@keel/compiler"
export default module({ id: "api", deps: ["@keel/std-jobs", "@keel/std-statecharts", "@keel/std-workflows"], capabilities: ["clock", "random", "storage"] })
`;
const topo = `import { topology } from "@keel/server"
export default topology({ web: { modules: ["api"], adapter: "node" } })
`;
const found = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);

function applyFix(files: Files, fix: string): Files {
  const dir = mkdtempSync(join(tmpdir(), "keel-fix-"));
  try {
    for (const f of files) {
      mkdirSync(dirname(join(dir, f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.source);
    }
    writeFileSync(join(dir, "fix.patch"), `${fix}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    return files.map((f) => ({ path: f.path, source: readFileSync(join(dir, f.path), "utf8") }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const chartSrc = (states: string, events: string) => `import { chart } from "@keel/std-statecharts"
import { s } from "@keel/schema"
export const removalChart = chart('api.removalChart', {
  data: s.object({}), start: {},
  events: ${events},
  initial: 'queued',
  states: ${states},
})
`;
const EVENTS =
  "{ begin: s.object({}), hide: s.object({}), purged: s.object({}), stuck: s.object({ code: s.string() }), expired: s.object({}), undo: s.object({}) }";
const STATES = `{
    queued: { on: { begin: 'purging', hide: 'hidden' } },
    purging: { on: { purged: 'purged', stuck: 'stuck' } },
    hidden: { on: { expired: 'gone', undo: 'queued' } },
    purged: { final: true },
    stuck: { final: true },
    gone: { final: true },
  }`;
const STEPS = "{ purging: { run: purgeList, done: 'purged', failed: 'stuck' } }";
const WAITS = "{ hidden: { ms: 600_000, event: 'expired' } }";

type Parts = {
  id?: string;
  steps?: string;
  waits?: string;
  chartStates?: string;
  workflowPath?: string;
  queue?: string;
  runners?: string;
};
const project = (p: Parts = {}): Files => [
  { path: "modules/api/module.ts", source: manifest },
  { path: "modules/api/removalChart.ts", source: chartSrc(p.chartStates ?? STATES, EVENTS) },
  {
    path: "modules/api/purgeList.server.ts",
    source: `import { ok } from "@keel/schema"\nexport const purgeList = async () => ok({})\n`,
  },
  {
    path: p.workflowPath ?? "modules/api/removal.server.ts",
    source: `import { workflow } from "@keel/std-workflows"
import { removalChart } from "./removalChart.ts"
import { purgeList } from "./purgeList.server.ts"
export const removal = workflow('${p.id ?? "api.removal"}', { chart: removalChart, steps: ${p.steps ?? STEPS}, waits: ${p.waits ?? WAITS} })
`,
  },
  {
    path: "modules/api/jobs.server.ts",
    source: `import { queue } from "@keel/std-jobs"
import { removal } from "./removal.server.ts"
export const jobs = queue(${p.queue ?? "{ ...removal.jobs }"})
`,
  },
  {
    path: "modules/api/runners.server.ts",
    source: `import { flows } from "@keel/std-workflows"
import { jobs } from "./jobs.server.ts"
import { removal } from "./removal.server.ts"
export const runners = ${p.runners ?? "[jobs, flows(jobs, [removal])]"}
`,
  },
  { path: "topology.ts", source: topo },
];
const word = fc.stringMatching(/^[a-z]{3,10}$/);

describe("std.workflows: keel check rules", () => {
  test.skip("E2351 fires on a `workflow` id not prefixed by its module and not on its clean twin.", () => {
    expect(found(project(), "E2351")).toEqual([]);
    fc.assert(
      fc.property(word, (name) => {
        expect(found(project({ id: name }), "E2351").length).toBe(1);
        expect(found(project({ id: `api.${name}` }), "E2351").length).toBe(0);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  test.skip("E2351 fires on a `workflow` outside `*.server.ts` and not on its clean twin.", () => {
    const files = project({ workflowPath: "modules/api/removal.ts" });
    expect(found(files, "E2351").length).toBe(1);
    expect(found(project(), "E2351").length).toBe(0);
  });

  test.skip("E2351's fix prefixes the id with the module id, and re-checking the patched file reports no E2351.", () => {
    fc.assert(
      fc.property(word, (name) => {
        const files = project({ id: name });
        const d = found(files, "E2351");
        expect(d.length).toBe(1);
        const fix = d[0]?.fix;
        expect(fix).toBeDefined();
        const patched = applyFix(files, fix ?? "");
        expect(patched.find((f) => f.path === "modules/api/removal.server.ts")?.source).toContain(`'api.${name}'`);
        expect(found(patched, "E2351").length).toBe(0);
      }),
      { seed: 1337, numRuns: 15 },
    );
  });

  const e2352: Record<string, Parts> = {
    "a step naming no state": { steps: "{ nowhere: { run: purgeList, done: 'purged', failed: 'stuck' } }" },
    "a step naming a final state": { steps: "{ purged: { run: purgeList, done: 'purged', failed: 'stuck' } }" },
    "a step whose `done` is not in the state's `on`": {
      steps: "{ purging: { run: purgeList, done: 'expired', failed: 'stuck' } }",
    },
    "a step whose `failed` is not in the state's `on`": {
      steps: "{ purging: { run: purgeList, done: 'purged', failed: 'expired' } }",
    },
    "a wait naming no state": { waits: "{ nowhere: { ms: 600_000, event: 'expired' } }" },
    "a wait naming a final state": { waits: "{ gone: { ms: 600_000, event: 'expired' } }" },
    "a wait whose event is not in the state's `on`": { waits: "{ hidden: { ms: 600_000, event: 'begin' } }" },
  };
  test.skip("E2352 fires on a step or wait naming no state or a final state, or whose `done`, `failed` or wait event is not in that state's `on`, and not on its clean twin.", () => {
    expect(found(project(), "E2352")).toEqual([]);
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(e2352)), (name) => {
        const d = found(project(e2352[name]), "E2352");
        expect(d.length, name).toBe(1);
        expect(d[0]?.fix, name).toBeUndefined();
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  test.skip("`workflow` throws E2352 for the same fixtures and not for the clean twin.", () => {
    const noop = async () => ok({ freed: 0 });
    const c = removalChart();
    const step = (done: "purged" | "expired", failed: "stuck" | "expired") => ({ run: noop, done, failed });
    expect(() => workflow(nextId("ok"), { chart: c, steps: { purging: step("purged", "stuck") } })).not.toThrow();
    const nowhere = Object.fromEntries([["nowhere", step("purged", "stuck")]]);
    expect(() => workflow(nextId("e"), { chart: c, steps: nowhere })).toThrow(/E2352/);
    expect(() => workflow(nextId("e"), { chart: c, steps: { purged: step("purged", "stuck") } })).toThrow(/E2352/);
    expect(() => workflow(nextId("e"), { chart: c, steps: { purging: step("expired", "stuck") } })).toThrow(/E2352/);
    expect(() => workflow(nextId("e"), { chart: c, steps: { purging: step("purged", "expired") } })).toThrow(/E2352/);
    const noWait = Object.fromEntries([["nowhere", { ms: 1000, event: "expired" }]]);
    expect(() => workflow(nextId("e"), { chart: c, waits: noWait })).toThrow(/E2352/);
    expect(() => workflow(nextId("e"), { chart: c, waits: { gone: { ms: 1000, event: "expired" } } })).toThrow(/E2352/);
    expect(() => workflow(nextId("e"), { chart: c, waits: { hidden: { ms: 1000, event: "begin" } } })).toThrow(/E2352/);
  });

  // reserving and charging are steps; charging's `failed` target is `stuck` (final) and reserving's `done` leads to charging.
  const SAGA_EVENTS =
    "{ begin: s.object({}), reserved: s.object({}), charged: s.object({}), declined: s.object({ code: s.string() }), released: s.object({}), busted: s.object({ code: s.string() }) }";
  const sagaStates = (declinedTo: string, extra: string) => `{
    queued: { on: { begin: 'reserving' } },
    reserving: { on: { reserved: 'charging', busted: 'stuck' } },
    charging: { on: { charged: 'paid', declined: '${declinedTo}' } },${extra}
    paid: { final: true },
    stuck: { final: true },
  }`;
  const saga = (declinedTo: string, extra: string): Files => [
    ...project({
      steps: `{ reserving: { run: purgeList, done: 'reserved', failed: 'busted' }, charging: { run: purgeList, done: 'charged', failed: 'declined' } }`,
      waits: "{}",
      chartStates: sagaStates(declinedTo, extra),
    }).map((f) =>
      f.path === "modules/api/removalChart.ts"
        ? { ...f, source: chartSrc(sagaStates(declinedTo, extra), SAGA_EVENTS) }
        : f,
    ),
  ];
  test.skip("W2353 fires on a step whose `failed` target is final while another step's `done` lies on a path to it, naming both, and not on its clean twin.", () => {
    const bad = found(saga("stuck", ""), "W2353");
    expect(bad.length).toBe(1);
    const text = JSON.stringify(bad[0]);
    expect(text).toContain("reserving");
    expect(text).toContain("charging");
    const clean = saga("undoing", "\n    undoing: { on: { released: 'reversed' } },\n    reversed: { final: true },");
    expect(found(clean, "W2353")).toEqual([]);
  });

  test.skip("E2354 fires on a module whose `queue` lacks a workflow's `jobs` and not on its clean twin.", () => {
    expect(found(project({ queue: "{}" }), "E2354").length).toBe(1);
    expect(found(project(), "E2354").length).toBe(0);
  });

  test.skip("E2354 fires on a module whose `runners` lack a workflow's `flows` and not on its clean twin.", () => {
    expect(found(project({ runners: "[jobs]" }), "E2354").length).toBe(1);
    expect(found(project({ runners: "[]" }), "E2354").length).toBeGreaterThanOrEqual(1);
    expect(found(project(), "E2354").length).toBe(0);
  });

  test.skip("E2354's fix adds the `jobs` to the `queue` and the `flows` to `runners`, and re-checking the patched files reports no E2354.", () => {
    for (const bad of [project({ queue: "{}" }), project({ runners: "[jobs]" })]) {
      const d = found(bad, "E2354");
      expect(d.length).toBe(1);
      const fix = d[0]?.fix;
      expect(fix).toBeDefined();
      const patched = applyFix(bad, fix ?? "");
      expect(found(patched, "E2354")).toEqual([]);
    }
  });
});
