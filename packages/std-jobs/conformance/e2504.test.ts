// Spec: std.jobs, clause "E2501-E2504 each fire on a fixture and not on its clean twin" (E2504)
// Spec: std.jobs, rule E2504: a module with `jobs.server.ts` whose `runners` lacks `jobs` (fix adds it), or placed in a non-`node` deployable.
// Seed 1337
// Assumption: as for std.i18n E2301, `check()` imports nothing, so the rules register by importing `@keel/std-jobs/tools`;
// a module is the files under `modules/<id>/` with a `module.ts` listing `deps`.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import "@keel/std-jobs/tools";
import fc from "fast-check";
import { expect, test } from "vitest";

type Files = Parameters<typeof check>[0];
const manifest = (extra = "") =>
  `import { module } from "@keel/compiler"
export default module({ id: "orders", deps: ["@keel/std-jobs"], capabilities: ["clock", "random", "storage"]${extra} })
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

const project = (runners: string, adapter = "node"): Files => [
  { path: "modules/orders/module.ts", source: manifest() },
  { path: "modules/orders/sendReceipt.server.ts", source: jobFile },
  {
    path: "modules/orders/jobs.server.ts",
    source: `import { queue } from "@keel/std-jobs"\nimport { sendReceipt } from "./sendReceipt.server.ts"\nexport const jobs = queue({ "orders.sendReceipt": sendReceipt })\n`,
  },
  {
    path: "modules/orders/runners.server.ts",
    source: `import { jobs } from "./jobs.server.ts"\nexport const runners = ${runners}\n`,
  },
  { path: "topology.ts", source: topo(adapter) },
];

test.skip("E2504 fires on a `runners` export lacking `jobs` and not on its clean twin.", () => {
  expect(found(project("[]"), "E2504").length).toBe(1);
  expect(found(project("[jobs]"), "E2504").length).toBe(0);
});

test.skip("E2504 fires on a module with jobs placed in a non-`node` deployable and not in a `node` one.", () => {
  fc.assert(
    fc.property(fc.constantFrom("static", "client"), (adapter) => {
      expect(found(project("[jobs]", adapter), "E2504").length).toBe(1);
      expect(found(project("[jobs]", "node"), "E2504").length).toBe(0);
    }),
    { seed: 1337, numRuns: 10 },
  );
});

test.skip("E2504's fix adds `jobs` to `runners`, and re-checking the patched file reports no E2504.", () => {
  const files = project("[]");
  const d = found(files, "E2504");
  expect(d.length).toBe(1);
  const patched = applyFix(files, d[0]?.fix ?? "");
  expect(patched.find((f) => f.path === "modules/orders/runners.server.ts")?.source).toContain("jobs]");
  expect(found(patched, "E2504").length).toBe(0);
});
