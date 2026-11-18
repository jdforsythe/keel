// Spec: k.user, Rules "E1579 `identity.server.ts` without a default `identity(...)` export, or a `handle.path` not of lowercase `/` segments, or with a route of any deployable at or under it (`keel check`, `keel build`; `createApp` throws it). Fix: none."
// Spec: k.user, Conformance "`caller: { days: 0 }`, `{ days: 401 }`, `{ days: 1.5 }`, `caller` on a `client` deployable, and `handle.path` `/api` with a route `/api/x` are each one diagnostic (E1578, E1579)."
// Seed 1337 (fc.assert below). In-memory project through `run(['build'])` and `run(['check'])`, as topology-e1559-same-path.test.ts.
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
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-e1579-"));
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
const identitySrc = (p: string) =>
  `import { identity } from '@keel/server'\nexport default identity({ identify: async () => '', handle: { path: '${p}', fn: () => new Response('') } })\n`;
const topologySrc = (split: boolean) =>
  `import { topology } from '@keel/server'\nexport default topology({ x: { modules: ['a'], adapter: 'node' }${split ? ", y: { modules: ['b'], adapter: 'node' }" : ""} })\n`;

const e1579 = async (command: "build" | "check", handle: string, route: string, split: boolean) => {
  const r = await run([command, "--format=json"], {
    cwd: tmp,
    env: { KEEL_AGENT: "1" },
    files: [
      { path: "topology.ts", source: topologySrc(split) },
      { path: "identity.server.ts", source: identitySrc(handle) },
      { path: "modules/a/module.ts", source: manifestSrc("a") },
      { path: "modules/a/routes.ts", source: routesSrc("a", split ? "/q-a" : route) },
      ...(split
        ? [
            { path: "modules/b/module.ts", source: manifestSrc("b") },
            { path: "modules/b/routes.ts", source: routesSrc("b", route) },
          ]
        : []),
    ],
  });
  return r.stdout.split("\n").filter((l) => l.includes('"E1579"'));
};

describe("k.user: E1579 route collision", () => {
  test("`handle.path` `/api` with a route `/api/x` is one E1579 in `keel check` and in `keel build`", async () => {
    for (const command of ["check", "build"] as const) {
      expect(await e1579(command, "/api", "/api/x", false)).toHaveLength(1);
    }
  });

  test("a route of any deployable at or under `handle.path` is one E1579, and `/auth` beside routes under `/app` is clean", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{1,6}$/),
        fc.constantFrom("", "/x", "/x/y"),
        fc.boolean(),
        async (seg, tail, split) => {
          const handle = `/${seg}`;
          for (const command of ["check", "build"] as const) {
            expect(await e1579(command, handle, `${handle}${tail}`, split)).toHaveLength(1);
            expect(await e1579(command, `/auth${seg}`, `/app${tail}`, split)).toEqual([]);
          }
        },
      ),
      { seed: SEED, numRuns: 4 },
    );
  });
});
