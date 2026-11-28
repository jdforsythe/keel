// @vitest-environment happy-dom
// Spec: k.contract, clause "With `api` serving `local: true` page `a.tools`, its component's text `comp-canary` and its loader's `load-canary`, `keel build` writes `comp-canary` and no `load-canary` under `dist/api/assets/`; a `GET` from remote address `10.0.0.5` is 403 `keel.denied`, holding neither."
// Seed: n/a (one fixture). Fixture (the RFC 0244 sketch): one `node` deployable `api` serving module `a`, whose page `a.tools` at `/tools` is `local: true`, its component a `Text` holding `comp-canary`, its loader returning `{ t: 'load-canary' }`.
// The built assets are read as text; the `GET` goes through `createApp`'s `fetch` with a connection whose `incoming.socket.remoteAddress` is `10.0.0.5`, over the same page declared in process.
// ASSUMED: (1) "under `dist/api/assets/`" is every file under that folder; (2) "any served file" is every file under `dist/api/` but `server.mjs` and `server.mjs.map`, which are never served (k.deploy Build);
// (3) the 403 body and headers hold neither canary.
import fs from "node:fs";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GOOD, SEED, conn, six } from "./local-routes-peer-support.ts";
import { REMOVE, buildProject } from "./local-routes-build-support.ts";
import { createAppLoose, withHeaders } from "./topology-fixtures.ts";

const COMP = "comp-canary";
const LOAD = "load-canary";
const FILES = {
  "topology.ts":
    'import { topology } from "@keel/server";\nexport default topology({ api: { modules: ["a"], adapter: "node" } });\n',
  "modules/a/module.ts":
    'import { module } from "@keel/compiler";\nexport default module({ id: "a", deps: [], capabilities: [], public: { exports: [] } });\n',
  "modules/a/a.contract.ts":
    'import { contract } from "@keel/router/contract";\nexport const a = contract("a", { "a.tools": { path: "/tools", local: true } });\n',
  "modules/a/Tools.schema.ts": 'import { s } from "@keel/schema";\nexport const Tools = s.object({ t: s.string() });\n',
  "modules/a/Tools.tsx": `import { Box, Text } from "@keel/ui";\nexport default function Tools() {\n  return <Box><Text id="a.tools.text">${COMP}</Text></Box>\n}\n`,
  "modules/a/tools.server.ts": `import { loader } from "@keel/router";\nimport { ok } from "@keel/schema";\nimport { a } from "./a.contract.ts";\nimport { Tools } from "./Tools.schema.ts";\nexport const tools = loader(a, "a.tools", { output: Tools }, async () => ok({ t: "${LOAD}" }));\n`,
  "modules/a/routes.ts":
    'import { manifest } from "@keel/router";\nimport { a } from "./a.contract.ts";\nimport Tools from "./Tools.tsx";\nimport { tools } from "./tools.server.ts";\nexport const routes = manifest(a, { "a.tools": { component: Tools, loader: tools } });\n',
};

const listing = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listing(p) : [p];
  });

let root = "";
beforeAll(() => {
  const b = buildProject(FILES);
  root = b.root;
  expect(b.status, b.out).toBe(0);
}, fixedTime(600_000));
afterAll(() => REMOVE(root));

describe("k.contract Local routes: a `local` page's component ships in the client assets, its loader does not", () => {
  it("`keel build` writes `comp-canary` under `dist/api/assets/`", () => {
    const texts = listing(path.join(root, "dist", "api", "assets")).map((f) => fs.readFileSync(f, "utf8"));
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((t) => t.includes(COMP))).toBe(true);
  });

  it("`keel build` writes no `load-canary` under `dist/api/assets/`", () => {
    for (const f of listing(path.join(root, "dist", "api", "assets")))
      expect(fs.readFileSync(f, "utf8").includes(LOAD), f).toBe(false);
  });

  it("the loader's `load-canary` is in no served file of `dist/api/`", () => {
    const served = listing(path.join(root, "dist", "api")).filter((f) => !/server\.mjs(\.map)?$/.test(f));
    expect(served.length).toBeGreaterThan(0);
    for (const f of served) expect(fs.readFileSync(f, "utf8").includes(LOAD), f).toBe(false);
  });

  it("a `GET` from remote address `10.0.0.5` is 403 `keel.denied`, holding neither", async () => {
    const c = contract("a", { "a.tools": { path: "/tools", local: true } });
    const l = loader(c, "a.tools", { output: s.object({ t: s.string() }) }, () => Promise.resolve(ok({ t: LOAD })));
    const comp = (): Node => {
      const el = document.createElement("main");
      el.textContent = COMP;
      return el;
    };
    const app = await createAppLoose({
      topology: topology({ api: { modules: ["a"], adapter: "node" } }),
      deployable: "api",
      routes: manifest(c, { "a.tools": { component: comp, loader: l } }),
      ctx: createCtx({ mode: "sim", seed: SEED }),
    });
    const req = withHeaders(new Request(`http://127.0.0.1:4317/tools`, { headers: { accept: "text/html" } }), GOOD);
    const got: unknown = await Reflect.apply(app.fetch, app, [req, conn("10.0.0.5")]);
    if (!(got instanceof Response)) throw new Error("fetch did not answer a Response");
    const res = got;
    expect(res.status).toBe(403);
    const body = await res.text();
    expect(body).toContain("keel.denied");
    expect(body).not.toContain(COMP);
    expect(body).not.toContain(LOAD);
    six(res, "10.0.0.5");
  });
});
