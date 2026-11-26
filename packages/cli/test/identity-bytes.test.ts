// Seed 1337 (no generated input: two fixtures, spawned builds). k.guards Client, D103 "identity is opt-in": the built
// client bundle of an app with no `identity.ts` holds no `/__keel/user` read (neither the path nor the reader's
// `x-keel` header); the same app with `identity.ts` (its `client` deployable `servedBy` a `node` one) holds it.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, expect, test } from "vitest";
import { type Tree, cleanup, keel, materialize } from "../conformance/compat-support.ts";

const SLOW = fixedTime(300_000);

/** A `client` deployable `web` over module `w`, one guarded page; with `identity`, also `identity.ts`, `identity.server.ts` and a `node` deployable `api` serving it. */
function tree(identity: boolean): Tree {
  const web = identity
    ? "web: { modules: ['w'], adapter: 'client', servedBy: 'api' }, api: { modules: ['a'], adapter: 'node' }"
    : "web: { modules: ['w'], adapter: 'client' }";
  const base: Tree = {
    "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`,
    "vite.config.ts":
      'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
    "tsconfig.json": JSON.stringify({
      compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
    }),
    "topology.ts": `import { topology } from '@keel/server'\nexport default topology({ ${web} })\n`,
    "modules/w/module.ts":
      "import { module } from '@keel/compiler'\nexport default module({ id: 'w', deps: [], capabilities: [], public: { exports: [] } })\n",
    "modules/w/w.contract.ts":
      "import { contract } from '@keel/router/contract'\nexport const w = contract('w', { 'w.home': { path: '/' }, 'w.in': { path: '/in' } })\n",
    "modules/w/signedIn.guard.ts":
      "import { guard } from '@keel/router'\nimport { err, ok } from '@keel/schema'\n" +
      "export const signedIn = guard({ redirect: 'w.in' }, async ({ user }) => (user === '' ? err({ code: 'keel.denied', message: 'No', data: null }) : ok(null)))\n",
    "modules/w/Page.tsx":
      "import { Box, Text } from '@keel/ui'\nexport default function Page() {\n  return (\n" +
      '    <Box id="w.page">\n      <Text id="w.page.text">Home</Text>\n    </Box>\n  )\n}\n',
    "modules/w/routes.ts":
      "import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nimport { signedIn } from './signedIn.guard.ts'\nimport { w } from './w.contract.ts'\n" +
      "export const routes = manifest(w, { 'w.home': { component: Page, guard: signedIn }, 'w.in': { component: Page } })\n",
  };
  if (!identity) return base;
  return {
    ...base,
    "identity.ts": "import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n",
    "identity.server.ts":
      "import { identity } from '@keel/server'\nimport mount from './identity.ts'\n" +
      "export default identity({ identify: async () => '', handle: { path: mount.path, fn: async () => new Response(null, { status: 404 }) } })\n",
    "modules/a/module.ts":
      "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n",
    "modules/a/a.contract.ts":
      "import { contract } from '@keel/router/contract'\nexport const a = contract('a', { 'a.home': { path: '/a' } })\n",
    "modules/a/Home.tsx":
      "import { Text } from '@keel/ui'\nexport default function Home() {\n  return <Text id=\"a.home.text\">A</Text>\n}\n",
    "modules/a/routes.ts":
      "import { manifest } from '@keel/router'\nimport Home from './Home.tsx'\nimport { a } from './a.contract.ts'\nexport const routes = manifest(a, { 'a.home': { component: Home } })\n",
  };
}

const dirs = new Map<boolean, string>();
beforeAll(() => {
  for (const v of [false, true]) dirs.set(v, materialize(tree(v)));
}, SLOW);
afterAll(() => {
  for (const d of dirs.values()) cleanup(d);
});

/** Every built script of deployable `web`, joined. */
function webScripts(identity: boolean): string {
  const dir = dirs.get(identity) ?? "";
  const r = keel(dir, ["build"]);
  expect(r.status, JSON.stringify(r.records.filter((x) => x.kind === "diag"))).toBe(0);
  const assets = join(dir, "dist", "web", "assets");
  const js = readdirSync(assets).filter((f) => f.endsWith(".js"));
  expect(js.length).toBeGreaterThan(0);
  return js.map((f) => readFileSync(join(assets, f), "utf8")).join("\n");
}

test(
  "with no identity.ts the client bundle holds no /__keel/user read",
  () => {
    const code = webScripts(false);
    expect(code.includes("/__keel/user")).toBe(false);
    expect(code.includes("x-keel")).toBe(false);
  },
  SLOW,
);

test(
  "with identity.ts the client bundle holds the read",
  () => {
    const code = webScripts(true);
    expect(code.includes("/__keel/user")).toBe(true);
    expect(code.includes("x-keel")).toBe(true);
  },
  SLOW,
);
