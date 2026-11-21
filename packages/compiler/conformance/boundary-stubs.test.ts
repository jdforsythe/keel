// @vitest-environment happy-dom
// Spec: k.boundary, Conformance "Each export of a stubbed file is a function throwing E1008 that names it; `manifest` takes stubs."
// Spec: k.boundary, Browser builds "Every browser build the Vite plugin runs (a `node` deployable's client build, a `client` deployable's, a shell's, the project's own) resolves an import of a server-only JS or TS file, without a query, to a stub: the file's export names (`export *` followed), each a function that throws an Error with code E1008 `<name> of <file> runs only on the server` when called, and no import but the router's. The file's code, imports and top-level statements are never evaluated in a browser. `manifest` accepts a stub wherever a loader, action or guard goes and skips its checks, which ran when the build evaluated `routes.ts` in Node (k.compiler), so the client router keeps typed params and search, `Link`, `navigate`, `Form` and `matchHref`; a page takes links from its contract (k.contract), which imports no server file. `node:sqlite` is mapped in the server build only."
// Spec: k.boundary, Rules "E1007 server code in a browser build (names the chain) · E1008 a stub of a server-only export called · E1009 `guard` from `@keel/router` used (k.bundle) outside a `*.guard.*` or `*.server.*` file (fix: none)."
// Seed 1337 (no random input: one fixture built once). `vite build` with `KEEL_DEPLOYABLE=web` over a temp project with `@keel/*` and `vite` linked; the single emitted script is run in this happy-dom window (no `process` global), as a browser runs it.
// Node `api` lists module `a` (so `a`'s `*.server.ts` files are server-only); `client` `web` lists module `w`, whose page and `routes.ts` import `a`'s `x.server.ts` and `save.server.ts`. The page records what it imported in `globalThis`.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TOP = "K_TOP_14e8b6d2a7c9305f8e1b";
const BODY = "K_STUB_a9c3e71d5b0842f6c1e9";
const MORE = "K_MORE_c40e9a7b1d62358f0a4e";
const X = "modules/a/x.server.ts";

const mod = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;

const files: Record<string, string> = {
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "index.html":
    '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>fx</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/@keel/entry.ts"></script>\n  </body>\n</html>\n',
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['a'], adapter: 'node' }, web: { modules: ['w'], adapter: 'client', servedBy: 'api' } })\n",
  "modules/a/module.ts": mod("a"),
  "modules/a/Params.schema.ts":
    "import { s } from '@keel/schema'\nexport const Params = s.object({ id: s.string() })\n",
  "modules/a/Search.schema.ts":
    "import { s } from '@keel/schema'\nexport const Search = s.object({ tab: s.string().optional() })\n",
  "modules/a/y.server.ts": `export const why = '${MORE}'\n`,
  "modules/a/x.server.ts": `import { guard, loader } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nimport { w } from '../w/w.contract.ts'\nReflect.set(globalThis, 'topRan', '${TOP}')\nexport const load = loader(w, 'w.show', { output: s.object({ title: s.string() }) }, async () => ok({ title: '${BODY}' }))\nexport const loadApi = loader(w, 'w.getApi', {}, async () => ok({ title: '${BODY}' }))\nexport const auth = guard({ redirect: 'w.home' }, async () => ok(null))\nexport const LIMIT = { max: '${BODY}' }\nexport default function main(): string {\n  return '${BODY}'\n}\nexport type Sized = number\nexport * from './y.server.ts'\n`,
  "modules/a/save.server.ts": `import { action } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nimport { w } from '../w/w.contract.ts'\nexport const save = action(w, 'w.show', { input: s.object({ note: s.string().optional() }) }, async () => ok(null))\nexport const saveApi = action(w, 'w.postApi', {}, async () => ok({ done: '${BODY}' }))\n`,
  "modules/w/module.ts": mod("w"),
  "modules/w/w.contract.ts":
    "import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nimport { Params } from '../a/Params.schema.ts'\nimport { Search } from '../a/Search.schema.ts'\n" +
    "export const w = contract('w', {\n  'w.home': { path: '/' },\n  'w.show': { path: '/w/:id', params: Params, search: Search },\n" +
    "  'w.getApi': { method: 'GET', path: '/api/w', output: s.object({ title: s.string() }) },\n" +
    "  'w.postApi': { method: 'POST', path: '/api/w', body: s.object({}), output: s.object({ done: s.string() }) },\n})\n",
  "modules/w/Probe.ts":
    "import def, { LIMIT, auth, load, loadApi, why } from '../a/x.server.ts'\nimport { save, saveApi } from '../a/save.server.ts'\n" +
    "export const probe = { def, LIMIT, auth, load, loadApi, why, save, saveApi }\n",
  "modules/w/Page.tsx":
    "import { w } from './w.contract.ts'\nimport { probe } from './Probe.ts'\n" +
    "Reflect.set(globalThis, 'probe', probe)\n" +
    "Reflect.set(globalThis, 'hrefsOf', () => [w.href('w.show', { id: 'q r' }, { tab: 'b' }), w.href('w.show', { id: 'x' })])\n" +
    "export default function Page() {\n  return null\n}\n",
  "modules/w/routes.ts":
    "import { manifest } from '@keel/router'\nimport { auth, load, loadApi } from '../a/x.server.ts'\nimport { save, saveApi } from '../a/save.server.ts'\nimport Page from './Page.tsx'\nimport { w } from './w.contract.ts'\n" +
    "export const routes = manifest(w, {\n  'w.home': { component: Page },\n" +
    "  'w.show': { guard: auth, loader: load, component: Page, POST: save },\n" +
    "  'w.getApi': { loader: loadApi },\n  'w.postApi': { action: saveApi },\n})\n",
};

let dir = "";
let status: number | null = null;
let log = "";
let script = "";
const probe = (): Record<string, unknown> => {
  const v: unknown = Reflect.get(globalThis, "probe");
  if (typeof v !== "object" || v === null) throw new Error("the page did not record its imports");
  return Object.fromEntries(Object.entries(v));
};
let ran: unknown = null;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "keel-boundary-stubs-"));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  mkdirSync(join(dir, "node_modules/@keel"), { recursive: true });
  for (const pkg of readdirSync(join(REPO, "packages"))) {
    symlinkSync(join(REPO, "packages", pkg), join(dir, "node_modules/@keel", pkg));
  }
  symlinkSync(join(REPO, "node_modules/vite"), join(dir, "node_modules/vite"));
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [join(dir, "node_modules/vite/bin/vite.js"), "build"], {
    cwd: dir,
    encoding: "utf8",
    env: { ...env, KEEL_DEPLOYABLE: "web" },
  });
  status = r.status;
  log = `${r.stdout}${r.stderr}`;
  const assets = join(dir, "dist", "web", "assets");
  const js = status === 0 ? readdirSync(assets).filter((f) => f.endsWith(".js")) : [];
  script = js.map((f) => readFileSync(join(assets, f), "utf8")).join("\n");
  if (status === 0) {
    document.body.innerHTML = '<div id="app"></div>';
    try {
      new Function(script)();
      ran = "ok";
    } catch (e) {
      ran = e;
    }
  }
}, SLOW);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const callIt = (v: unknown): unknown => {
  if (typeof v !== "function") throw new Error(`not a function: ${typeof v}`);
  try {
    Reflect.apply(v, undefined, []);
  } catch (e) {
    return e;
  }
  throw new Error("the call returned");
};

describe("k.boundary: in a browser build a server-only import resolves to a stub", () => {
  test("the browser build exits 0 and its script runs in the window", () => {
    expect(status, log).toBe(0);
    expect(ran instanceof Error ? ran.stack : ran).toBe("ok");
  });

  for (const name of ["def", "LIMIT", "auth", "load", "loadApi", "why", "save", "saveApi"] as const) {
    test(`the import \`${name}\` is a function that throws an Error with code E1008 naming it and \`${X}\` when called`, () => {
      expect(ran).toBe("ok");
      const v = probe()[name];
      expect(typeof v).toBe("function");
      const err = callIt(v);
      expect(err).toBeInstanceOf(Error);
      expect(Reflect.get(err instanceof Error ? err : {}, "code")).toBe("E1008");
      const message = err instanceof Error ? err.message : "";
      expect(message).toContain(name === "def" ? "default" : name);
      expect(message).toContain("runs only on the server");
      expect(message).toContain(name === "save" || name === "saveApi" ? "modules/a/save.server.ts" : X);
    });
  }

  test("a property read of a stub is `undefined`: `LIMIT.max`", () => {
    expect(ran).toBe("ok");
    const limit = probe().LIMIT;
    expect(typeof limit).toBe("function");
    expect(Reflect.get(Object(limit), "max")).toBeUndefined();
  });

  test("nothing in a server-only file's top level runs in a browser: its top-level statement left no trace", () => {
    expect(ran).toBe("ok");
    expect(Reflect.get(globalThis, "topRan")).toBeUndefined();
  });

  test("no code, constant or import of a server-only file, nor of what only they import, is in the emitted script", () => {
    expect(status, log).toBe(0);
    for (const needle of [TOP, BODY, MORE]) expect(script).not.toContain(needle);
  });
});

describe("k.boundary: `manifest` accepts a stub wherever a loader, action or guard goes", () => {
  test("a manifest naming stub loaders, guards and actions on a page and on an API route throws nothing at load", () => {
    expect(ran).toBe("ok");
    expect(Object.keys(probe())).toEqual(["def", "LIMIT", "auth", "load", "loadApi", "why", "save", "saveApi"]);
  });

  test("`href` of a page importing its contract still encodes typed params and search", () => {
    expect(ran).toBe("ok");
    const hrefsOf: unknown = Reflect.get(globalThis, "hrefsOf");
    expect(typeof hrefsOf).toBe("function");
    expect(typeof hrefsOf === "function" ? hrefsOf() : null).toEqual(["/w/q%20r?tab=b", "/w/x"]);
  });
});
