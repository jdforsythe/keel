// Fixture projects and build runners for the k.boundary conformance files (not a test file). Seed 1337 for every property.
// Public surface only: the `keel` binary and `vite build` over a temp project with `@keel/*` and `vite` linked, as compat-support.ts.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, statSync, symlinkSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { type Tree, materialize as linked } from "./compat-support.ts";

export { SEED, cleanup, write } from "./compat-support.ts";
export type { Tree } from "./compat-support.ts";

export const SLOW = 600_000;
const BIN = fileURLToPath(new URL("../src/bin.ts", import.meta.url));

/** Distinct random-looking constants, each written into exactly one fixture file. */
export const CANARY = {
  loader: "K_LOADER_5c1e8a7d2f9b43a6e0d1",
  action: "K_ACTION_b7094e2c61a85d3f9c20",
  guard: "K_GUARD_3e8d57a0c4b9162f7a5e",
  deep: "K_DEEP_91f6a3c8e2d7405b8a14",
  side: "K_SIDE_d20c7b95a1e3486f0c9a",
  client: "K_CLIENT_6a4f1e90b3d8725c1e7b",
  clientGuard: "K_CGUARD_0b97c5e2a8d1346f9e3d",
  plain: "K_PLAIN_e5183d7a9c2b604f1a8c",
  notes: "K_NOTES_7d02b9e4f6a15c38d0e2",
  stub: "K_STUB_a9c3e71d5b0842f6c1e9",
  top: "K_TOP_14e8b6d2a7c9305f8e1b",
} as const;

export const manifestSrc = (id: string, extra = ""): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] }${extra} })\n`;

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    jsx: "react-jsx",
    jsxImportSource: "@keel/runtime-dom",
    module: "esnext",
    moduleResolution: "bundler",
    target: "es2022",
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    allowImportingTsExtensions: true,
  },
});

export type Placement = "node" | "static" | "none";

/**
 * Module `a`: `a.home` at `/` and `a.show` at `/a/:id` with typed params and search, a loader in `load.server.ts`
 * (which imports `helper.ts` -> `deep.ts` and `side.server.ts`), a guard in `auth.guard.ts` and, unless `actions` is
 * false, a POST action in `save.server.ts`; `Page.tsx` links and posts with `routes.href`.
 */
export function moduleA(actions: boolean): Tree {
  const c = CANARY;
  return {
    "modules/a/module.ts": manifestSrc("a"),
    "modules/a/Params.schema.ts":
      "import { s } from '@keel/schema'\nexport const Params = s.object({ id: s.string() })\n",
    "modules/a/Search.schema.ts":
      "import { s } from '@keel/schema'\nexport const Search = s.object({ tab: s.string().optional() })\n",
    "modules/a/Out.schema.ts": "import { s } from '@keel/schema'\nexport const Out = s.object({ title: s.string() })\n",
    "modules/a/deep.ts": `export const deep = '${c.deep}'\n`,
    "modules/a/helper.ts":
      "import { deep } from './deep.ts'\nexport const helper = (id: string): string => `${deep}:${id}`\n",
    "modules/a/side.server.ts": `Reflect.set(globalThis, 'sideRan', '${c.side}')\nexport const side = 1\n`,
    "modules/a/load.server.ts": `import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { Out } from './Out.schema.ts'\nimport { Params } from './Params.schema.ts'\nimport { Search } from './Search.schema.ts'\nimport { helper } from './helper.ts'\nimport { side } from './side.server.ts'\nexport const load = loader({ output: Out, params: Params, search: Search }, async ({ params }) => {\n  Reflect.set(globalThis, 'loaderRan', '${c.loader}')\n  return ok({ title: \`\${helper(params.id)}\${side}\` })\n})\n`,
    "modules/a/auth.guard.ts": `import { guard } from '@keel/router'\nimport { ok } from '@keel/schema'\nexport const auth = guard({ redirect: 'a.home' }, async () => {\n  Reflect.set(globalThis, 'guardRan', '${c.guard}')\n  return ok(null)\n})\n`,
    ...(actions
      ? {
          "modules/a/save.server.ts": `import { writeFileSync } from 'node:fs'\nimport { action } from '@keel/router'\nimport { ok, s } from '@keel/schema'\nexport const save = action({ input: s.object({ note: s.string().optional() }) }, async () => {\n  writeFileSync(process.env.K_MARK ?? '', '${c.action}')\n  return ok(null)\n})\n`,
        }
      : {}),
    "modules/a/Home.tsx":
      "import { Box, Text } from '@keel/ui'\nexport default function Home() {\n  return (\n    <Box as=\"main\">\n      <Text>home</Text>\n    </Box>\n  )\n}\n",
    "modules/a/Page.tsx":
      "import { Form } from '@keel/router'\nimport { Box, Button, Link } from '@keel/ui'\nimport { routes } from './routes.ts'\n" +
      'export default function Page() {\n  return (\n    <Box as="main">\n' +
      "      <Link to={routes.href('a.show', { id: 'x' }, { tab: 'b' })}>Next</Link>\n" +
      "      <Form method=\"POST\" action={routes.href('a.show', { id: 'x' })}>\n        <Button>Save</Button>\n      </Form>\n    </Box>\n  )\n}\n",
    "modules/a/routes.ts": `import { manifest } from '@keel/router'\nimport Home from './Home.tsx'\nimport Page from './Page.tsx'\nimport { auth } from './auth.guard.ts'\nimport { load } from './load.server.ts'\n${actions ? "import { save } from './save.server.ts'\n" : ""}import { Params } from './Params.schema.ts'\nimport { Search } from './Search.schema.ts'\nexport const routes = manifest({\n  'a.home': { path: '/', component: Home },\n  'a.show': { path: '/a/:id', params: Params, search: Search, guard: auth, loader: load, component: Page },\n})\n${actions ? "routes.actions({ 'a.show': { POST: save } })\n" : ""}`,
  };
}

/** Module `w` of a `client` deployable: its `*.server.ts` loader and `*.guard.ts` guard run in the browser. */
export function moduleW(): Tree {
  const c = CANARY;
  return {
    "modules/w/module.ts": manifestSrc("w"),
    "modules/w/Out.schema.ts": "import { s } from '@keel/schema'\nexport const Out = s.object({ title: s.string() })\n",
    "modules/w/loadW.server.ts": `import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { Out } from './Out.schema.ts'\nexport const loadW = loader({ output: Out }, async () => {\n  Reflect.set(globalThis, 'clientLoaderRan', '${c.client}')\n  return ok({ title: 'w' })\n})\n`,
    "modules/w/pick.guard.ts": `import { guard } from '@keel/router'\nimport { ok } from '@keel/schema'\nexport const pick = guard({ redirect: 'w.login' }, async () => {\n  Reflect.set(globalThis, 'clientGuardRan', '${c.clientGuard}')\n  return ok(null)\n})\n`,
    "modules/w/View.tsx":
      "import { Box, Link } from '@keel/ui'\nimport { routes } from './routes.ts'\n" +
      "export default function View() {\n  return (\n    <Box as=\"main\">\n      <Link to={routes.href('w.login')}>Sign in</Link>\n    </Box>\n  )\n}\n",
    "modules/w/Login.tsx":
      "import { Box, Text } from '@keel/ui'\nexport default function Login() {\n  return (\n    <Box as=\"main\">\n      <Text>login</Text>\n    </Box>\n  )\n}\n",
    "modules/w/routes.ts":
      "import { manifest } from '@keel/router'\nimport Login from './Login.tsx'\nimport View from './View.tsx'\n" +
      "import { loadW } from './loadW.server.ts'\nimport { pick } from './pick.guard.ts'\n" +
      "export const routes = manifest({\n  'w.home': { path: '/app', guard: pick, loader: loadW, component: View },\n  'w.login': { path: '/login', component: Login },\n})\n",
  };
}

const VITE_CONFIG =
  'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n';
const HTML = (src: string): string =>
  `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>fx</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="${src}"></script>\n  </body>\n</html>\n`;

/** A browser entry for a project the plugin builds with its own `index.html`: it reads the page and the manifest. */
const ENTRY =
  "import Page from './Page.tsx'\nimport { routes } from './routes.ts'\n" +
  "Reflect.set(globalThis, 'entryPage', [Page, routes.href('a.show', { id: 'x' })])\nexport const entry = 1\n";

/** The shared project root files: package, config, tsconfig. */
export const base = (): Tree => ({
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`,
  "vite.config.ts": VITE_CONFIG,
  "tsconfig.json": TSCONFIG,
});

/** Module `a` on a `node` deployable `api`, on a `static` one `web`, or with no `topology.ts`. */
export function nodeTree(placement: Placement = "node"): Tree {
  const topology =
    placement === "none"
      ? {}
      : {
          "topology.ts": `import { topology } from '@keel/server'\nexport default topology({ ${placement === "node" ? "api: { modules: ['a'], adapter: 'node' }" : "web: { modules: ['a'], adapter: 'static' }"} })\n`,
        };
  return {
    ...base(),
    ...topology,
    ...moduleA(placement === "node"),
    ...(placement === "node" ? {} : { "index.html": HTML("/modules/a/entry.ts"), "modules/a/entry.ts": ENTRY }),
  };
}

/** `nodeTree('node')` plus a `client` deployable `web` hosted by `api` with module `w`. */
export function clientTree(): Tree {
  return {
    ...nodeTree("node"),
    ...moduleW(),
    "topology.ts":
      "import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['a'], adapter: 'node' }, web: { modules: ['w'], adapter: 'client', host: 'api' } })\n",
    "index.html": HTML("/@keel/entry.ts"),
  };
}

export type Out = { status: number | null; out: string };

/** The environment a child gets: the parent's without the test runner's keys and `KEEL_*` peers, plus `extra`. */
export function childEnv(extra: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (
      k.startsWith("VITEST") ||
      k === "NODE_OPTIONS" ||
      k === "TEST" ||
      k.startsWith("KEEL_") ||
      k.startsWith("VITE_")
    )
      continue;
    env[k] = v;
  }
  return { ...env, ...extra };
}

/** `keel <args> --format=json` in `dir`. */
export function keelRun(dir: string, args: string[], env: Record<string, string> = {}): Out {
  const r = spawnSync(process.execPath, [BIN, ...args, "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env: childEnv(env),
    timeout: SLOW,
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

/** `vite build` in `dir` with `KEEL_DEPLOYABLE` set to `deployable` (when given), as `keel build` runs it per deployable. */
export function viteBuild(dir: string, deployable: string | undefined, env: Record<string, string> = {}): Out {
  const r = spawnSync(process.execPath, [join(dir, "node_modules", "vite", "bin", "vite.js"), "build"], {
    cwd: dir,
    encoding: "utf8",
    env: childEnv({ ...(deployable === undefined ? {} : { KEEL_DEPLOYABLE: deployable }), ...env }),
    timeout: SLOW,
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

/** Every file under `root` (absolute paths), `node_modules` excluded; none when `root` is missing. */
export function filesUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    let names: string[];
    try {
      names = readdirSync(d);
    } catch {
      return;
    }
    for (const n of names) {
      if (n === "node_modules") continue;
      const full = join(d, n);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

/** The files under `root` (relative to it) whose bytes contain `needle`, `skip` names excluded. */
export function filesHolding(root: string, needle: string, skip: readonly string[] = []): string[] {
  return filesUnder(root)
    .map((f) => relative(root, f))
    .filter((rel) => !skip.includes(rel))
    .filter((rel) => readFileSync(join(root, rel)).includes(Buffer.from(needle)));
}

/** The JSON-lines records of a command's output that carry `code`. */
export function recordsOf(out: string, code: string): string[] {
  return out.split("\n").filter((l) => l.includes(`"${code}"`));
}

export const built = (dir: string, env: Record<string, string> = {}): Out => keelRun(dir, ["build"], env);

const PNPM = fileURLToPath(new URL("../../../node_modules/.pnpm/", import.meta.url));

/** `tree` written to a temp project with `@keel/*`, `vite` and the Node types linked. */
export function materialize(tree: Tree): string {
  const dir = linked(tree);
  const types = readdirSync(PNPM).find((n) => n.startsWith("@types+node@2"));
  if (types !== undefined) {
    const store = join(PNPM, types, "node_modules");
    mkdirSync(join(dir, "node_modules", "@types"), { recursive: true });
    symlinkSync(join(store, "@types", "node"), join(dir, "node_modules", "@types", "node"));
    symlinkSync(join(store, "undici-types"), join(dir, "node_modules", "undici-types"));
  }
  return dir;
}

export type Reply = { status: number; headers: http.IncomingHttpHeaders; body: string };

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });

/** One request to `127.0.0.1:port`; the redirect is not followed. */
export function send(
  port: number,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: string,
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }),
      );
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

/** Runs `node dist/<name>/server.mjs` on a free port with `env`, waits until it answers, runs `fn`, kills that child only. */
export async function withServer(
  dir: string,
  name: string,
  env: Record<string, string>,
  fn: (port: number) => Promise<void>,
): Promise<void> {
  const port = await freePort();
  const child = spawn(process.execPath, [join(dir, "dist", name, "server.mjs")], {
    cwd: dir,
    env: childEnv({ PORT: String(port), KEEL_SECRET: "s".repeat(32), ...env }),
    stdio: "ignore",
  });
  try {
    let up = false;
    for (let i = 0; i < 4000 && !up; i++) {
      up = await send(port, "GET", "/", { accept: "text/html" }).then(
        () => true,
        () => false,
      );
    }
    if (!up) throw new Error("server.mjs did not answer");
    await fn(port);
  } finally {
    child.kill("SIGTERM");
  }
}

/** The distinct lines of `out` that contain `needle`, trimmed. */
export function linesWith(out: string, needle: string): string[] {
  return [
    ...new Set(
      out
        .split("\n")
        .filter((l) => l.includes(needle))
        .map((l) => l.trim()),
    ),
  ];
}

/** `tree` with `files` added or replaced. */
export const withFiles = (tree: Tree, files: Tree): Tree => ({ ...tree, ...files });
