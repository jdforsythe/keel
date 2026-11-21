// Spec: std.jobs, clause "E2501-E2504 each fire on a fixture and not on its clean twin; a `queue` whose input holds `s.secret` throws E2503." (E2501)
// Spec: std.jobs, rule E2501: a `queue` key not prefixed by its module id, or a `queue` outside `modules/<id>/jobs.server.ts` (fix prefixes the key).
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

const queueSrc = (key: string) =>
  `import { queue } from "@keel/std-jobs"\nimport { sendReceipt } from "./sendReceipt.server.ts"\nexport const jobs = queue({ "${key}": sendReceipt })\n`;
const project = (key: string, path = "modules/orders/jobs.server.ts"): Files => [
  { path: "modules/orders/module.ts", source: manifest() },
  { path: "modules/orders/sendReceipt.server.ts", source: jobFile },
  { path, source: queueSrc(key) },
  {
    path: "modules/orders/runners.server.ts",
    source: `import { jobs } from "./jobs.server.ts"\nexport const runners = [jobs]\n`,
  },
  { path: "topology.ts", source: topo("node") },
];

test("E2501 fires on a `queue` key not prefixed by its module id and not on its clean twin.", () => {
  fc.assert(
    fc.property(word, (name) => {
      expect(found(project(`${name}`), "E2501").length).toBe(1);
      expect(found(project(`orders.${name}`), "E2501").length).toBe(0);
    }),
    { seed: 1337, numRuns: 30 },
  );
});

test("E2501 fires on a `queue` outside `modules/<id>/jobs.server.ts` and not on its clean twin.", () => {
  expect(found(project("orders.sendReceipt", "modules/orders/other.server.ts"), "E2501").length).toBe(1);
  expect(found(project("orders.sendReceipt"), "E2501").length).toBe(0);
});

test("E2501's fix prefixes the key with the module id, and re-checking the patched file reports no E2501.", () => {
  fc.assert(
    fc.property(word, (name) => {
      const files = project(name);
      const d = found(files, "E2501");
      expect(d.length).toBe(1);
      const fix = d[0]?.fix;
      expect(fix).toBeDefined();
      const patched = applyFix(files, fix ?? "");
      expect(patched.find((f) => f.path === "modules/orders/jobs.server.ts")?.source).toContain(`"orders.${name}"`);
      expect(found(patched, "E2501").length).toBe(0);
    }),
    { seed: 1337, numRuns: 20 },
  );
});
