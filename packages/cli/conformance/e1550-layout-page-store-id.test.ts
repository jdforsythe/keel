// k.server, Rules "E1550 ... `keel check` at the deeper loader's `stores` value ...; `keel build` and `createApp` run each factory once on a sim ctx (k.compat Surface) and refuse it"
// Spec: k.server, clause "A layout whose loader names factory `a` and a page under it whose loader names `b`, where `b` spreads `a()` and both create store id `x.s`, is one E1550 in `keel check` at the page loader's `stores` value naming `a`, `b`, `x.s` and the layout's id, and `createApp` throws E1550; with both loaders naming `a`, neither, and a GET of the page answers 200 with `a` run once."
// Seed: 1337.
// In-memory project through `run(['check'])` and `run(['build'])`, as topology-e1558-unreadable.test.ts.
// Not built yet: `test.skip`; the builder changes each to `test`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "@keel/cli";
import { afterAll, beforeAll, expect, test } from "vitest";

const ROOT_PKGS = ["compiler", "router", "schema", "server", "ctx", "store"];
let tmp = "";
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-e1550-"));
  fs.mkdirSync(path.join(tmp, "node_modules", "@keel"), { recursive: true });
  for (const p of ROOT_PKGS) {
    fs.symlinkSync(path.resolve(import.meta.dirname, "..", "..", p), path.join(tmp, "node_modules", "@keel", p));
  }
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const server = (pageStores: "a" | "b") => `import { loader } from '@keel/router'
import { ok, s } from '@keel/schema'
import { store } from '@keel/store'
import { a as c } from './a.contract.ts'
const S = s.object({})
const a = () => ({ s: store(S, {}, { id: 'x.s' }) })
const b = () => ({ ...a(), t: store(S, {}, { id: 'x.s' }) })
export const L = loader(c, 'a.layout', { output: S, stores: a }, async () => ok({}))
export const P = loader(c, 'a.page', { output: S, stores: ${pageStores} }, async () => ok({}))
`;

const e1550 = async (command: "build" | "check", pageStores: "a" | "b") => {
  const r = await run([command, "--format=json"], {
    cwd: tmp,
    env: { KEEL_AGENT: "1" },
    files: [
      {
        path: "topology.ts",
        source: `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['a'], adapter: 'node' } })\n`,
      },
      {
        path: "modules/a/module.ts",
        source: `import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n`,
      },
      {
        path: "modules/a/a.contract.ts",
        source: `import { contract } from '@keel/router/contract'\nexport const a = contract('a', { 'a.layout': { layout: true }, 'a.page': { path: '/p' } })\n`,
      },
      {
        path: "modules/a/routes.ts",
        source: `import { manifest } from '@keel/router'\nimport { a } from './a.contract.ts'\nimport { L, P } from './a.server.ts'\nconst C = () => null\nexport const routes = manifest(a, { 'a.layout': { component: C, loader: L }, 'a.page': { component: C, layout: 'a.layout', loader: P } })\n`,
      },
      { path: "modules/a/a.server.ts", source: server(pageStores) },
    ],
  });
  return r.stdout.split("\n").filter((l) => l.includes('"E1550"'));
};

for (const command of ["check", "build"] as const) {
  test(`a layout's loader naming \`a\` and its page's naming \`b\`, both creating store id \`x.s\`, is one E1550 in \`keel ${command}\`; both naming \`a\`, none`, async () => {
    const lines = await e1550(command, "b");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("modules/a/a.server.ts");
    expect(await e1550(command, "a")).toEqual([]);
  });
}
