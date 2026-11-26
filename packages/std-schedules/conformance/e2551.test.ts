// Spec: std.schedules, clause "`60 * * * *`, `* * * *`, `@daily` and `0 0 * * MON` are each one E2551, and `schedule` throws E2551 for each."
// std.schedules, rule E2551: a `cron` or `zone` literal that does not parse, naming the field (no fix; `schedule` also throws it).
// Assumption: as for std.i18n E2301, `check()` imports nothing, so the rules register by importing `@keel/std-jobs/tools`;
// a module is the files under `modules/<id>/` with a `module.ts` listing `deps`.
import { fixedTime } from "@keel/tooling/test-time";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import "@keel/std-jobs/tools";
import "@keel/std-schedules/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

type Files = Parameters<typeof check>[0];
const manifest = (extra = "") =>
  `import { module } from "@keel/compiler"
export default module({ id: "orders", deps: ["@keel/std-jobs", "@keel/std-schedules"], capabilities: ["clock", "random", "storage"]${extra} })
`;
const topo = (adapter: string) => `import { topology } from "@keel/server"
export default topology({ web: { modules: ["orders"], adapter: "${adapter}" } })
`;
const found = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);
const jobFile = `import { job } from "@keel/std-jobs"
import { ok, s } from "@keel/schema"
export const sendReceipt = job({ input: s.object({ id: s.string() }) }, async () => ok(null))
`;

function applyFix(files: Files, fix: string): Files {
  const dir = mkdtempSync(join(tmpdir(), "keel-fix-"));
  try {
    for (const f of files) {
      mkdirSync(dirname(join(dir, f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.source);
    }
    writeFileSync(
      join(dir, "fix.patch"),
      `${fix}
`,
    );
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    return files.map((f) => ({ path: f.path, source: readFileSync(join(dir, f.path), "utf8") }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const word = fc.stringMatching(/^[a-z]{3,10}$/);

const jobsFile = `import { job, queue } from "@keel/std-jobs"
import { ok, s } from "@keel/schema"
const digest = job({ input: s.object({}) }, async () => ok(null))
export const jobs = queue({ "orders.digest": digest })
`;
const entry = (key: string, cron: string, zone: string) =>
  `import { schedule } from "@keel/std-schedules"
import { jobs } from "./jobs.server.ts"
export const schedules = schedule(jobs, { "${key}": { cron: "${cron}", zone: "${zone}", job: "orders.digest", input: {} } })
`;
const project = (o: { key?: string; cron?: string; zone?: string; path?: string; runners?: string } = {}): Files => [
  { path: "modules/orders/module.ts", source: manifest() },
  { path: "modules/orders/jobs.server.ts", source: jobsFile },
  {
    path: o.path ?? "modules/orders/schedules.server.ts",
    source: entry(o.key ?? "orders.nightly", o.cron ?? "0 3 * * *", o.zone ?? "UTC"),
  },
  {
    path: "modules/orders/runners.server.ts",
    source: `import { jobs } from "./jobs.server.ts"
import { schedules } from "./schedules.server.ts"
export const runners = ${o.runners ?? "[jobs, schedules]"}
`,
  },
  { path: "topology.ts", source: topo("node") },
];
import { job, queue } from "@keel/std-jobs";
import { schedule } from "@keel/std-schedules";
import { ok, s } from "@keel/schema";

const BAD = ["60 * * * *", "* * * *", "@daily", "0 0 * * MON"];
const mkJobs = () => queue({ "orders.digest": job({ input: s.object({}) }, async () => ok(null)) });
const table = (cron: string, zone = "UTC") =>
  ({ "orders.x": { cron, zone, job: "orders.digest", input: {} } }) as const;

test(
  "`60 * * * *`, `* * * *`, `@daily` and `0 0 * * MON` are each one E2551, and a clean twin is none.",
  () => {
    for (const cron of BAD) {
      const d = found(project({ cron }), "E2551");
      expect(d.length).toBe(1);
      expect(d[0]?.fix).toBeUndefined();
    }
    expect(found(project({ cron: "0 0 * * 1" }), "E2551").length).toBe(0);
  },
  fixedTime(30_000),
);

test(
  "E2551 names the field: `60 * * * *` names the minute field.",
  () => {
    const d = found(project({ cron: "60 * * * *" }), "E2551");
    expect(d[0]?.message.toLowerCase()).toContain("minute");
  },
  fixedTime(30_000),
);

test(
  "A `zone` literal that is not a `TimeZone` is one E2551, and a clean twin is none.",
  () => {
    expect(found(project({ zone: "Mars/Olympus" }), "E2551").length).toBe(1);
    expect(found(project({ zone: "utc" }), "E2551").length).toBe(1);
    expect(found(project({ zone: "Europe/Berlin" }), "E2551").length).toBe(0);
    expect(found(project({ zone: "UTC" }), "E2551").length).toBe(0);
  },
  fixedTime(30_000),
);

test("`schedule` throws E2551 for `60 * * * *`, `* * * *`, `@daily` and `0 0 * * MON`, and for a `zone` that does not parse, and not for a valid entry.", () => {
  for (const cron of BAD) expect(() => schedule(mkJobs(), table(cron))).toThrow(/E2551/);
  expect(() => schedule(mkJobs(), table("0 3 * * *", "Mars/Olympus"))).toThrow(/E2551/);
  expect(() => schedule(mkJobs(), table("0 3 * * *", "Europe/Berlin"))).not.toThrow();
});

test(
  "For generated out-of-range numbers in each of the five fields, `schedule` throws E2551 and `check` reports one E2551.",
  () => {
    const limits = [60, 24, 32, 13, 7] as const;
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 50 }), (i, extra) => {
        const parts = ["*", "*", "*", "*", "*"];
        parts[i] = String((limits[i] ?? 0) + extra);
        const cron = parts.join(" ");
        expect(() => schedule(mkJobs(), table(cron))).toThrow(/E2551/);
        expect(found(project({ cron }), "E2551").length).toBe(1);
      }),
      { seed: 1337, numRuns: 40 },
    );
  },
  fixedTime(30_000),
);
