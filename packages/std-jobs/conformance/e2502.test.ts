// Spec: std.jobs, clause "E2501-E2504 each fire on a fixture and not on its clean twin; a `queue` whose input holds `s.secret` throws E2503." (E2502)
// std.jobs, rule E2502: `jobs` in `public.exports` (fix removes it).
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

const project = (exports: string[]): Files => [
  { path: "modules/orders/module.ts", source: manifest(`, public: { exports: ${JSON.stringify(exports)} }`) },
  { path: "modules/orders/sendReceipt.server.ts", source: jobFile },
  {
    path: "modules/orders/jobs.server.ts",
    source: `import { queue } from "@keel/std-jobs"\nimport { sendReceipt } from "./sendReceipt.server.ts"\nexport const jobs = queue({ "orders.sendReceipt": sendReceipt })\n`,
  },
  {
    path: "modules/orders/runners.server.ts",
    source: `import { jobs } from "./jobs.server.ts"\nexport const runners = [jobs]\n`,
  },
  { path: "topology.ts", source: topo("node") },
];

test("E2502 fires on `jobs` in `public.exports` and not on its clean twin.", () => {
  fc.assert(
    fc.property(
      fc.array(
        word.filter((w) => w !== "jobs"),
        { maxLength: 3 },
      ),
      (others) => {
        expect(found(project([...others, "jobs"]), "E2502").length).toBe(1);
        expect(found(project(others), "E2502").length).toBe(0);
      },
    ),
    { seed: 1337, numRuns: 30 },
  );
}, 30_000);

test("E2502's fix removes `jobs` from `public.exports`, and re-checking the patched file reports no E2502.", () => {
  const files = project(["sendReceipt", "jobs"]);
  const d = found(files, "E2502");
  expect(d.length).toBe(1);
  const patched = applyFix(files, d[0]?.fix ?? "");
  expect(found(patched, "E2502").length).toBe(0);
  expect(patched.find((f) => f.path === "modules/orders/module.ts")?.source).toContain("sendReceipt");
}, 30_000);
