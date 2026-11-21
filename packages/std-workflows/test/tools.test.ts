import { check } from "@keel/check";
import "@keel/std-workflows/tools";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

type Files = Parameters<typeof check>[0];
const found = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);

const chart = `chart('api.removalChart', {
  data: s.object({}), start: {},
  events: { begin: s.object({}), purged: s.object({}), stuck: s.object({ code: s.string() }) },
  initial: 'queued',
  states: { queued: { on: { begin: 'purging' } }, purging: { on: { purged: 'purged', stuck: 'stuck' } }, purged: { final: true }, stuck: { final: true } },
})`;
const head = `import { chart } from "@keel/std-statecharts"\nimport { s } from "@keel/schema"\n`;
const flow = (done: string, chartRef: string) =>
  `workflow('api.removal', { chart: ${chartRef}, steps: { purging: { run: purgeList, done: '${done}', failed: 'stuck' } } })`;
const wfHead = `import { workflow } from "@keel/std-workflows"\nimport { purgeList } from "./purgeList.server.ts"\n`;

const base = (wf: string, extra: Files = []): Files => [
  ...extra,
  { path: "modules/api/purgeList.server.ts", source: "export const purgeList = async () => ({ ok: true })\n" },
  { path: "modules/api/removal.server.ts", source: wf },
  {
    path: "modules/api/jobs.server.ts",
    source: `import { queue } from "@keel/std-jobs"\nexport const jobs = queue({})\n`,
  },
  { path: "modules/api/runners.server.ts", source: "export const runners = []\n" },
];

describe("std.workflows tools", () => {
  test("E2352 fires once on the workflow file whichever of it and its chart file is checked first.", () => {
    const wf = `${wfHead}import { removalChart } from "./c.ts"\nexport const removal = ${flow("begin", "removalChart")}\n`;
    const c = { path: "modules/api/c.ts", source: `${head}export const removalChart = ${chart}\n` };
    fc.assert(
      fc.property(fc.boolean(), (first) => {
        const files = first ? base(wf, [c]) : [...base(wf), c];
        const d = found(files, "E2352");
        expect(d.map((x) => x.path)).toEqual(["modules/api/removal.server.ts"]);
      }),
      { seed: 1337, numRuns: 4 },
    );
  });

  test("E2352 reads a chart declared inline and one declared as a local const.", () => {
    const inline = `${head}${wfHead}export const removal = ${flow("begin", chart)}\n`;
    const local = `${head}${wfHead}const c = ${chart}\nexport const removal = ${flow("begin", "c")}\n`;
    expect(found(base(inline), "E2352").length).toBe(1);
    expect(found(base(local), "E2352").length).toBe(1);
    expect(found(base(local.replace("done: 'begin'", "done: 'purged'")), "E2352")).toEqual([]);
  });

  test("E2354 fixes add the workflow import to a queue and the flows and jobs imports to runners.", () => {
    const files = base(`${head}${wfHead}export const removal = ${flow("purged", chart)}\n`);
    const fixes = found(files, "E2354").map((d) => d.fix ?? "");
    expect(fixes.length).toBe(2);
    expect(fixes.join("\n")).toContain('+import { removal } from "./removal.server.ts"');
    expect(fixes.join("\n")).toContain('+import { flows } from "@keel/std-workflows"');
    expect(fixes.join("\n")).toContain("flows(jobs, [removal])");
    expect(fixes.join("\n")).toContain("queue({ ...removal.jobs })");
  });
});
