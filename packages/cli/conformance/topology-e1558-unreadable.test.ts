// Spec: k.topology, Conformance "In a `client` module's `*.server.ts`, `loader({ output }, feed)` with `const feed = async function* …`, `r.loader({ output, stores })` through `import * as r`, and `loader({ ...base, output }, fn)` are each one E1558 in `keel check` and `keel build`; `loader({ output }, load)` with `load` an `async function` of the file is none."
// Seed: 1337.
// In-memory project through `run(['check'])` and `run(['build'])`, as topology-e1558-client-stores-0095.test.ts.
// ASSUMPTION: the diagnostic is reported at the call in `modules/<id>/<id>.server.ts`; each diagnostic is one line of the json stream.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "@keel/cli";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const SEED = 1337;
const ROOT_PKGS = ["compiler", "router", "schema", "server", "ctx", "store"];
let tmp = "";
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-e1558-unreadable-"));
  fs.mkdirSync(path.join(tmp, "node_modules", "@keel"), { recursive: true });
  for (const p of ROOT_PKGS) {
    fs.symlinkSync(path.resolve(import.meta.dirname, "..", "..", p), path.join(tmp, "node_modules", "@keel", p));
  }
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

type Variant = "const-generator" | "namespace-import" | "spread-options";
const VARIANTS: readonly Variant[] = ["const-generator", "namespace-import", "spread-options"];

const HEAD = `import { loader } from '@keel/router'\nimport { ok, s } from '@keel/schema'\n`;
const SERVER_FILE: Record<Variant, string> = {
  "const-generator": `${HEAD}const feed = async function* () {\n  yield ok({})\n}\nexport const L = loader({ output: s.object({}) }, feed)\n`,
  "namespace-import": `import * as r from '@keel/router'\nimport { ok, s } from '@keel/schema'\nexport const L = r.loader({ output: s.object({}), stores: () => ({}) }, async () => ok({}))\n`,
  "spread-options": `${HEAD}const base = { params: s.object({}) }\nexport const L = loader({ ...base, output: s.object({}) }, async () => ok({}))\n`,
};
const PLAIN_ASYNC_FILE = `${HEAD}async function load() {\n  return ok({})\n}\nexport const L = loader({ output: s.object({}) }, load)\n`;

const manifestSrc = (id: string) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;
const routesSrc = (id: string) =>
  `import { manifest } from '@keel/router'\nconst Page = () => null\nexport const routes = manifest({ '${id}.page': { path: '/${id}', component: Page } })\n`;

const e1558 = async (command: "build" | "check", adapter: "client" | "node", id: string, server: string) => {
  const r = await run([command, "--format=json"], {
    cwd: tmp,
    env: { KEEL_AGENT: "1" },
    files: [
      {
        path: "topology.ts",
        source: `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['${id}'], adapter: '${adapter}' } })\n`,
      },
      { path: `modules/${id}/module.ts`, source: manifestSrc(id) },
      { path: `modules/${id}/routes.ts`, source: routesSrc(id) },
      { path: `modules/${id}/${id}.server.ts`, source: server },
    ],
  });
  return r.stdout.split("\n").filter((l) => l.includes('"E1558"'));
};

describe("k.topology: E1558 reads what it can and reports what it cannot", () => {
  for (const command of ["check", "build"] as const) {
    for (const v of VARIANTS) {
      test(`${v} in a \`client\` module's \`*.server.ts\` is one E1558 in \`keel ${command}\`; in a \`node\` deployable's module none`, async () => {
        const lines = await e1558(command, "client", "a", SERVER_FILE[v]);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain("modules/a/a.server.ts");
        expect(await e1558(command, "node", "a", SERVER_FILE[v])).toEqual([]);
      });
    }
    test(`\`loader({ output }, load)\` with \`load\` an \`async function\` of the file is none in \`keel ${command}\``, async () => {
      expect(await e1558(command, "client", "a", PLAIN_ASYNC_FILE)).toEqual([]);
    });
  }

  test("property: for any module id and variant, `check` and `build` each report one E1558 for a `client` deployable and none for `node`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{3,8}$/), fc.constantFrom(...VARIANTS), async (id, v) => {
        for (const command of ["check", "build"] as const) {
          expect(await e1558(command, "client", id, SERVER_FILE[v])).toHaveLength(1);
          expect(await e1558(command, "node", id, SERVER_FILE[v])).toEqual([]);
        }
      }),
      { seed: SEED, numRuns: 4 },
    );
  });
});
