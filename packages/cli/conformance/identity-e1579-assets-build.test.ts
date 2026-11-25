// Spec: k.user, Conformance "For every `handle.path` `p` of lowercase `/` segments and no route at or under it, `keel check`, `keel build` and `createApp` each report E1579 exactly when `p` is `/assets` or begins `/assets/`: `/assets` and `/assets/auth` give one each, `/assetsx` and `/api/assets` none; the same holds for `p` given as `identity.ts`'s `.path`."
// Seed 1337 (fc.assert below). In-memory project through `run(['build'])` and `run(['check'])`, as identity-e1579-build.test.ts. The check-only message and position cases are packages/check/conformance/identity-e1579-assets.test.ts.
// ASSUMPTION: each E1579 is one line of the `--format=json` output holding `"E1579"`, as identity-e1579-build.test.ts reads it; a handle.path of `/assets` fails the build on its own (no route under it).
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
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-e1579-assets-"));
  fs.mkdirSync(path.join(tmp, "node_modules", "@keel"), { recursive: true });
  for (const p of ROOT_PKGS) {
    fs.symlinkSync(path.resolve(import.meta.dirname, "..", "..", p), path.join(tmp, "node_modules", "@keel", p));
  }
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const manifestSrc = `import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n`;
const routesSrc = `import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\nconst Page = () => null\nexport const routes = manifest(a, { 'a.page': { component: Page } })\n`;
const contractSrc = `import { contract } from '@keel/router/contract'\nexport const a = contract('a', { 'a.page': { path: '/app' } })\n`;
const SERVER = (handle: string) =>
  `import { identity } from '@keel/server'\n${handle}export default identity({ identify: async () => '', handle: { path: ${handle === "" ? "'LIT'" : "mount.path"}, fn: () => new Response('') } })\n`;

const e1579 = async (command: "build" | "check", p: string, viaMount: boolean) => {
  const r = await run([command, "--format=json"], {
    cwd: tmp,
    env: { KEEL_AGENT: "1" },
    files: [
      {
        path: "topology.ts",
        source: `import { topology } from '@keel/server'\nexport default topology({ x: { modules: ['a'], adapter: 'node' } })\n`,
      },
      ...(viaMount
        ? [
            {
              path: "identity.ts",
              source: `import { identityMount } from '@keel/router'\nexport default identityMount('${p}')\n`,
            },
            { path: "identity.server.ts", source: SERVER("import mount from './identity.ts'\n") },
          ]
        : [{ path: "identity.server.ts", source: SERVER("").replace("LIT", p) }]),
      { path: "modules/a/module.ts", source: manifestSrc },
      { path: "modules/a/routes.ts", source: routesSrc },
      { path: "modules/a/a.contract.ts", source: contractSrc },
    ],
  });
  return r.stdout.split("\n").filter((l) => l.includes('"E1579"'));
};

describe("k.user: E1579 refuses a handle.path at or under /assets in keel check and keel build", () => {
  test("keel check and keel build each give one E1579 for /assets and /assets/auth and none for /assetsx and /api/assets, as a literal and as identity.ts's .path", async () => {
    for (const command of ["check", "build"] as const) {
      for (const viaMount of [false, true]) {
        expect(await e1579(command, "/assets", viaMount)).toHaveLength(1);
        expect(await e1579(command, "/assets/auth", viaMount)).toHaveLength(1);
        expect(await e1579(command, "/assetsx", viaMount)).toEqual([]);
        expect(await e1579(command, "/api/assets", viaMount)).toEqual([]);
      }
    }
  });

  test("for every handle.path of lowercase / segments and no route at or under it, keel check and keel build report E1579 exactly when it is /assets or begins /assets/", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("assets", "assetsx", "api"),
        fc.array(fc.stringMatching(/^[a-z]{1,5}$/), { maxLength: 2 }),
        fc.boolean(),
        async (head, tail, viaMount) => {
          const p = `/${[head, ...tail].join("/")}`;
          const want = head === "assets" ? 1 : 0;
          for (const command of ["check", "build"] as const) {
            expect(await e1579(command, p, viaMount), `${command} ${p}`).toHaveLength(want);
          }
        },
      ),
      { seed: SEED, numRuns: 6 },
    );
  });
});
