// Spec: std.schedules, clause "E2552 and E2553 each fire on a fixture and not on its clean twin." (E2553)
// std.schedules, rule E2553: a module with `schedules.server.ts` whose `runners` lacks `schedules` (fix adds it).
// Assumption: as for std.i18n E2301, `check()` imports nothing, so the rules register by importing `@keel/std-jobs/tools`;
// a module is the files under `modules/<id>/` with a `module.ts` listing `deps`.
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

test("E2553 fires on a `runners` export lacking `schedules` and not on its clean twin.", () => {
  expect(found(project({ runners: "[jobs]" }), "E2553").length).toBe(1);
  expect(found(project({ runners: "[]" }), "E2553").length).toBe(1);
  expect(found(project({ runners: "[jobs, schedules]" }), "E2553").length).toBe(0);
}, 30_000);

test("E2553's fix adds `schedules` to `runners`, and re-checking the patched file reports no E2553.", () => {
  const files = project({ runners: "[jobs]" });
  const d = found(files, "E2553");
  expect(d.length).toBe(1);
  const patched = applyFix(files, d[0]?.fix ?? "");
  expect(patched.find((f) => f.path === "modules/orders/runners.server.ts")?.source).toContain("schedules");
  expect(found(patched, "E2553").length).toBe(0);
}, 30_000);
