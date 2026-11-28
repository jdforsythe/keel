// Spec: std.jobs, clause "E2501-E2504 each fire on a fixture and not on its clean twin; a `queue` whose input holds `s.secret` throws E2503." (E2503)
// std.jobs, rule E2503: a job `input` schema holding `s.secret` (no fix; `queue` also throws it).
// Spec: std.jobs, clause "E2503 fires for `job` reached through `import * as jobs` and not for a `.secret()` call on an object other than `@keel/schema`'s `s`." (rfc:0092)
// Seed 1337
// Assumption: as for std.i18n E2301, `check()` imports nothing, so the rules register by importing `@keel/std-jobs/tools`;
// a module is the files under `modules/<id>/` with a `module.ts` listing `deps`.
import { fixedTime } from "@keel/tooling/test-time";
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

import { job, queue } from "@keel/std-jobs";
import { ok, s } from "@keel/schema";

const project = (inputSrc: string): Files => [
  { path: "modules/orders/module.ts", source: manifest() },
  {
    path: "modules/orders/sendReceipt.server.ts",
    source: `import { job } from "@keel/std-jobs"\nimport { ok, s } from "@keel/schema"\nexport const sendReceipt = job({ input: ${inputSrc} }, async () => ok(null))\n`,
  },
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

test(
  "E2503 fires on a job `input` schema holding `s.secret` and not on its clean twin, and carries no fix.",
  () => {
    fc.assert(
      fc.property(word, (field) => {
        const bad = found(project(`s.object({ ${field}: s.secret(s.string()) })`), "E2503");
        expect(bad.length).toBe(1);
        expect(bad[0]?.fix).toBeUndefined();
        expect(found(project(`s.object({ ${field}: s.string() })`), "E2503").length).toBe(0);
      }),
      { seed: 1337, numRuns: 30 },
    );
  },
  fixedTime(30_000),
);

test(
  "E2503 fires on `s.secret` nested in an object, array or optional inside the job `input`.",
  () => {
    for (const src of [
      "s.object({ a: s.object({ b: s.secret(s.string()) }) })",
      "s.object({ a: s.array(s.secret(s.string())) })",
      "s.object({ a: s.secret(s.string()).optional() })",
    ]) {
      expect(found(project(src), "E2503").length).toBe(1);
    }
  },
  fixedTime(30_000),
);

test("A `queue` whose input holds `s.secret` throws E2503.", () => {
  fc.assert(
    fc.property(word, (field) => {
      const bad = job({ input: s.object({ [field]: s.secret(s.string()) }) }, async () => ok(null));
      expect(() => queue({ "orders.bad": bad })).toThrow(/E2503/);
      const fine = job({ input: s.object({ [field]: s.string() }) }, async () => ok(null));
      expect(() => queue({ "orders.fine": fine })).not.toThrow();
    }),
    { seed: 1337, numRuns: 20 },
  );
});

const withJobFile = (source: string): Files =>
  project("s.object({})").map((f) =>
    f.path === "modules/orders/sendReceipt.server.ts" ? { path: f.path, source } : f,
  );

test(
  "E2503 fires for `job` reached through `import * as jobs`.",
  () => {
    fc.assert(
      fc.property(word, (field) => {
        const viaNamespace = (inner: string) =>
          withJobFile(
            `import * as jobs from "@keel/std-jobs"\nimport { ok, s } from "@keel/schema"\nexport const sendReceipt = jobs.job({ input: s.object({ ${field}: ${inner} }) }, async () => ok(null))\n`,
          );
        expect(found(viaNamespace("s.secret(s.string())"), "E2503").length).toBe(1);
        expect(found(viaNamespace("s.string()"), "E2503").length).toBe(0);
      }),
      { seed: 1337, numRuns: 20 },
    );
  },
  fixedTime(30_000),
);

test(
  "E2503 does not fire for a `.secret()` call on an object other than `@keel/schema`'s `s`.",
  () => {
    fc.assert(
      fc.property(word, (field) => {
        const vaultInInput = withJobFile(
          `import { job } from "@keel/std-jobs"\nimport { ok, s } from "@keel/schema"\nconst vault = { secret: (x: unknown) => x }\nexport const sendReceipt = job({ input: vault.secret(s.object({ ${field}: s.string() })) }, async () => ok(null))\n`,
        );
        expect(found(vaultInInput, "E2503").length).toBe(0);
        const vaultInBody = withJobFile(
          `import { job } from "@keel/std-jobs"\nimport { ok, s } from "@keel/schema"\nconst vault = { secret: (x: unknown) => x }\nexport const sendReceipt = job({ input: s.object({ ${field}: s.string() }) }, async () => { vault.secret(1); return ok(null) })\n`,
        );
        expect(found(vaultInBody, "E2503").length).toBe(0);
      }),
      { seed: 1337, numRuns: 20 },
    );
  },
  fixedTime(30_000),
);
