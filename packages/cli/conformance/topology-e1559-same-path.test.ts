// Spec: k.topology Conformance, "Two routes with path `/p` in modules of different deployables are one E1559 in `keel check` and in `keel build`." Rule E1559 (names both routes).
// Seed 1337 (fc.assert below). In-memory project through `run(['build'])` and `run(['check'])`, as module-std-artifact-build.test.ts.
// ASSUMPTION: both commands report it; the diagnostic message names both route ids.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "@keel/cli";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED } from "./topology-modules.ts";

const ROOT_PKGS = ["compiler", "router", "schema", "server", "ctx"];
let tmp = "";
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-e1559-"));
  fs.mkdirSync(path.join(tmp, "node_modules", "@keel"), { recursive: true });
  for (const p of ROOT_PKGS) {
    fs.symlinkSync(path.resolve(import.meta.dirname, "..", "..", p), path.join(tmp, "node_modules", "@keel", p));
  }
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const manifestSrc = (id: string) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;
const routesSrc = (id: string, p: string) =>
  `import { manifest } from '@keel/router'\nconst Page = () => null\nexport const routes = manifest({ '${id}.page': { path: '${p}', component: Page } })\n`;
const topologySrc = (same: boolean) =>
  `import { topology } from '@keel/server'\nexport default topology({ x: { modules: ['a'${same ? ", 'b'" : ""}], adapter: 'node' }${same ? "" : ", y: { modules: ['b'], adapter: 'node' }"} })\n`;

const e1559 = async (command: "build" | "check", same: boolean, pa: string, pb: string) => {
  const r = await run([command, "--format=json"], {
    cwd: tmp,
    env: { KEEL_AGENT: "1" },
    files: [
      { path: "topology.ts", source: topologySrc(same) },
      { path: "modules/a/module.ts", source: manifestSrc("a") },
      { path: "modules/a/routes.ts", source: routesSrc("a", pa) },
      { path: "modules/b/module.ts", source: manifestSrc("b") },
      { path: "modules/b/routes.ts", source: routesSrc("b", pb) },
    ],
  });
  return r.stdout.split("\n").filter((l) => l.includes('"E1559"'));
};

describe("k.topology: E1559", () => {
  test("Two routes with path `/p` in modules of different deployables are one E1559 in `keel check` and in `keel build`.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^\/[a-z]{1,8}$/), async (p) => {
        for (const command of ["check", "build"] as const) {
          const lines = await e1559(command, false, p, p);
          expect(lines).toHaveLength(1);
          expect(lines[0]).toContain("E1559");
          expect(lines[0]).toContain("a.page");
          expect(lines[0]).toContain("b.page");
          expect(await e1559(command, true, p, p)).toEqual([]);
          expect(await e1559(command, false, p, `${p}x`)).toEqual([]);
        }
      }),
      { seed: SEED, numRuns: 4 },
    );
  });
});
