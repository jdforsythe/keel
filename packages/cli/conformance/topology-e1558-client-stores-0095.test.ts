// Spec: k.topology, clause "In a module a `client` deployable serves, a `loader` naming `stores`, an `action` naming `stores` and a loader whose `fn` is `async function*` are each one E1558 in `keel check` and `keel build`, and `createApp` for that deployable throws E1558; in a `node` deployable's module none is."
// Seed: 1337.
// @vitest-environment happy-dom
// In-memory project through `run(['check'])` and `run(['build'])`, as topology-e1559-same-path.test.ts. ASSUMPTION: the
// diagnostic is reported at the call in `modules/<id>/<name>.server.ts`; each diagnostic is one line of the json stream.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "@keel/cli";
import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED, createAppLoose, simCtx } from "./topology-modules.ts";

const ROOT_PKGS = ["compiler", "router", "schema", "server", "ctx", "store"];
let tmp = "";
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-e1558-"));
  fs.mkdirSync(path.join(tmp, "node_modules", "@keel"), { recursive: true });
  for (const p of ROOT_PKGS) {
    fs.symlinkSync(path.resolve(import.meta.dirname, "..", "..", p), path.join(tmp, "node_modules", "@keel", p));
  }
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

type Variant = "loader-stores" | "action-stores" | "live-loader";
const VARIANTS: readonly Variant[] = ["loader-stores", "action-stores", "live-loader"];

const SERVER_FILE: Record<Variant, (id: string) => string> = {
  "loader-stores": () =>
    `import { loader } from '@keel/router'\nimport { ok, s } from '@keel/schema'\ndeclare const c: never\nexport const L = loader(c, 'a.page', { output: s.object({}), stores: () => ({}) }, async () => ok({}))\n`,
  "action-stores": () =>
    `import { action } from '@keel/router'\nimport { ok, s } from '@keel/schema'\ndeclare const c: never\nexport const A = action(c, 'a.page', { input: s.object({}), stores: () => ({}) }, async () => ok(null))\n`,
  // a live loader belongs to an `events: true` API entry
  "live-loader": (id) =>
    `import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\ndeclare const c: never\nexport const L = loader(c, '${id}.feed', {}, async function* () {\n  yield ok({})\n})\n`,
};
const CLEAN_FILE = `import { loader } from '@keel/router'\nimport { ok, s } from '@keel/schema'\ndeclare const c: never\nexport const L = loader(c, 'a.page', { output: s.object({}) }, async () => ok({}))\n`;

const manifestSrc = (id: string) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const routesSrc = (id: string, v: Variant | "clean") =>
  `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\n${v === "live-loader" ? `import { L } from './${id}.server.ts'\n` : ""}const Page = () => null\nexport const routes = manifest(${id}, { '${id}.page': { component: Page }${v === "live-loader" ? `, '${id}.feed': { loader: L }` : ""} })\n`;
const contractSrc = (id: string, v: Variant | "clean") =>
  `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const ${id} = contract('${id}', { '${id}.page': { path: '/${id}' }${v === "live-loader" ? `, '${id}.feed': { method: 'GET', path: '/api/${id}/feed', output: s.object({}), events: true }` : ""} })\n`;

const e1558 = async (command: "build" | "check", adapter: "client" | "node", id: string, v: Variant | "clean") => {
  const r = await run([command, "--format=json"], {
    cwd: tmp,
    env: { KEEL_AGENT: "1" },
    files: [
      {
        path: "topology.ts",
        source: `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['${id}'], adapter: '${adapter}' } })\n`,
      },
      { path: `modules/${id}/module.ts`, source: manifestSrc(id) },
      { path: `modules/${id}/routes.ts`, source: routesSrc(id, v) },
      { path: `modules/${id}/${id}.contract.ts`, source: contractSrc(id, v) },
      { path: `modules/${id}/${id}.server.ts`, source: v === "clean" ? CLEAN_FILE : SERVER_FILE[v](id) },
    ],
  });
  return r.stdout.split("\n").filter((l) => l.includes('"E1558"'));
};

describe("k.topology: E1558 in client modules", () => {
  for (const command of ["check", "build"] as const) {
    for (const v of VARIANTS) {
      test(`${v} in a module a \`client\` deployable serves is one E1558 in \`keel ${command}\`; in a \`node\` deployable's module none`, async () => {
        const lines = await e1558(command, "client", "a", v);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain("modules/a/a.server.ts");
        expect(await e1558(command, "node", "a", v)).toEqual([]);
      });
    }
    test(`a plain loader in a \`client\` module is not E1558 in \`keel ${command}\``, async () => {
      expect(await e1558(command, "client", "a", "clean")).toEqual([]);
    });
  }

  test("property: for any module id and variant, `check` and `build` each report one E1558 for a `client` deployable and none for `node`", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{3,8}$/), fc.constantFrom(...VARIANTS), async (id, v) => {
        for (const command of ["check", "build"] as const) {
          expect(await e1558(command, "client", id, v)).toHaveLength(1);
          expect(await e1558(command, "node", id, v)).toEqual([]);
        }
      }),
      { seed: SEED, numRuns: 4 },
    );
  });
});

const appContract = contract("app", { "app.page": { path: "/" } });
// a live loader belongs to an `events: true` API entry
const liveContract = contract("app", {
  "app.page": { path: "/" },
  "app.feed": { method: "GET", path: "/api/feed", output: s.object({}), events: true },
});
const live = Reflect.apply(loader, undefined, [
  liveContract,
  "app.feed",
  {},
  async function* () {
    yield ok({});
  },
]);
const withStores = loader(appContract, "app.page", { output: s.object({}), stores: () => ({}) }, () =>
  Promise.resolve(ok({})),
);
const actionWithStores = action(appContract, "app.page", { input: s.object({}), stores: () => ({}) }, () =>
  Promise.resolve(ok(null)),
);

const build = (adapter: "client" | "node", v: Variant): Promise<unknown> => {
  const view = () => document.createElement("main");
  const routes =
    v === "live-loader"
      ? manifest(liveContract, { "app.page": { component: view }, "app.feed": { loader: live } })
      : manifest(appContract, {
          "app.page": {
            component: view,
            ...(v === "action-stores" ? { POST: actionWithStores } : { loader: withStores }),
          },
        });
  return createAppLoose({
    topology: topology({ web: { modules: ["app"], adapter } }),
    routes,
    ctx: simCtx(),
  }).then(
    () => "built",
    (e: unknown) => (e instanceof Error ? e.message : JSON.stringify(e)),
  );
};

describe("k.topology: E1558 from createApp", () => {
  for (const v of VARIANTS) {
    test(`\`createApp\` for a \`client\` deployable throws E1558 for ${v}; for a \`node\` deployable it builds`, async () => {
      expect(await build("client", v)).toContain("E1558");
      expect(await build("node", v)).toBe("built");
    });
  }
});
