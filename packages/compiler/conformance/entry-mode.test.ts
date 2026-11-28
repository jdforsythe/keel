// k.runtime API, clause "Both take `mode` (k.errors): `'dev'` only under `keel dev`, else `'production'` (k.deploy)."
// k.runtime Islands: the generated resume entry calls `resume(document.body, components, { ctx, stores, mode })`.
// k.router Client: `createRouter(routes, { ctx, history, mode? })` takes `mount`'s `mode`.
// k.deploy Build: "`keel build` runs Vite with `NODE_ENV=production`, whatever the shell or `.env` sets: the entries' `mode` is `'production'`."
// k.runtime API, the entries carry `"dev"` only when Vite's command is exactly `serve`; a missing or unknown command gives `"production"`.
// Seed: 1337 (no random input: the entries and `import.meta.env` stand-ins are enumerated).
// The served entries are read as the Vite dev server serves `/@keel/entry.ts` for a fixture app; the built entries are read as the plugin's `load` hands them to a Vite build; `resumeEntry()` is called unbundled.
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resumeEntry } from "@keel/compiler/internal/entry/resumeEntry";
import keel from "@keel/compiler/vite";
import { type Plugin, build, createServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const SLOW = 180_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;

const tree = (adapter: "client" | "node"): Record<string, string> => ({
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "index.html":
    '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>fx</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/@keel/entry.ts"></script>\n  </body>\n</html>\n',
  "topology.ts": `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['c'], adapter: '${adapter}' } })\n`,
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/routes.ts":
    "import { manifest } from '@keel/router'\nimport { c } from './c.contract.ts'\nconst Page = () => null\nexport const routes = manifest(c, { 'c.page': { component: Page } })\n",
  "modules/c/c.contract.ts":
    "import { contract } from '@keel/router/contract'\nexport const c = contract('c', { 'c.page': { path: '/' } })\n",
});

const dirs: string[] = [];

function fixture(adapter: "client" | "node"): string {
  const dir = mkdtempSync(join(tmpdir(), `keel-entry-mode-${adapter}-`));
  dirs.push(dir);
  for (const [p, c] of Object.entries(tree(adapter))) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  mkdirSync(join(dir, "node_modules/@keel"), { recursive: true });
  for (const pkg of readdirSync(join(REPO, "packages"))) {
    symlinkSync(join(REPO, "packages", pkg), join(dir, "node_modules/@keel", pkg));
  }
  for (const name of ["vite", "typescript", "fast-check"]) {
    symlinkSync(join(REPO, "node_modules", name), join(dir, "node_modules", name));
  }
  return dir;
}

/** The entry text Vite's dev server serves at `/@keel/entry.ts`. */
async function entryText(dir: string): Promise<string> {
  const saved = process.env.KEEL_DEPLOYABLE;
  process.env.KEEL_DEPLOYABLE = "web";
  const server = await createServer({
    root: dir,
    configFile: join(dir, "vite.config.ts"),
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const r = await server.transformRequest("/@keel/entry.ts");
    if (r === null) throw new Error("no entry served");
    return r.code;
  } finally {
    await server.close();
    if (saved === undefined) Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    else process.env.KEEL_DEPLOYABLE = saved;
  }
}

/** The entry text the plugin's `load` returns to a Vite `build` (the bundler's input, before any dead-code removal). */
async function builtEntryText(dir: string): Promise<string> {
  const saved = process.env.KEEL_DEPLOYABLE;
  process.env.KEEL_DEPLOYABLE = "web";
  let seen = "";
  try {
    await build({
      root: dir,
      configFile: join(dir, "vite.config.ts"),
      logLevel: "silent",
      plugins: [
        {
          name: "capture-entry",
          enforce: "post",
          transform(code: string, id: string) {
            if (id.includes("@keel/entry")) seen = code;
            return null;
          },
        },
      ],
      build: { minify: false },
    });
  } finally {
    if (saved === undefined) Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    else process.env.KEEL_DEPLOYABLE = saved;
  }
  if (seen === "") throw new Error("no entry loaded by the build");
  return seen;
}

/**
 * The entry text the plugin's `load` returns to a Vite `build` where the plugin sees `command` in place of Vite's:
 * `"undefined"` reports no command, any other string is reported as is.
 */
async function entryTextUnderCommand(dir: string, command: string): Promise<string> {
  const saved = process.env.KEEL_DEPLOYABLE;
  process.env.KEEL_DEPLOYABLE = "web";
  let seen = "";
  const plugins: Plugin[] = [];
  for (const p of [keel()].flat()) {
    if (p === null || typeof p !== "object" || !("name" in p)) continue;
    const run = p.configResolved;
    plugins.push({
      ...p,
      configResolved(config) {
        const reported = command === "undefined" ? undefined : command;
        const view = new Proxy(config, { get: (t, k, r) => (k === "command" ? reported : Reflect.get(t, k, r)) });
        return run?.call(this, view);
      },
    });
  }
  try {
    try {
      await build({
        root: dir,
        configFile: false,
        logLevel: "silent",
        plugins: [
          ...plugins,
          {
            name: "capture-entry",
            enforce: "post",
            transform(code: string, id: string) {
              if (id.includes("@keel/entry")) seen = code;
              return null;
            },
          },
        ],
        build: { minify: false },
      });
    } catch (e) {
      // a plugin that never saw `configResolved` may fail after `load`, in `closeBundle`; only the entry is read
      if (seen === "") throw e;
    }
  } finally {
    if (saved === undefined) Reflect.deleteProperty(process.env, "KEEL_DEPLOYABLE");
    else process.env.KEEL_DEPLOYABLE = saved;
  }
  if (seen === "") throw new Error("no entry loaded by the build");
  return seen;
}

/** The right-hand side of the entry's `mode` binding. */
function modeBinding(code: string): string {
  const m = /(?:const|let|var)\s+mode\s*=\s*([^;\n]+)/.exec(code);
  if (m === null || m[1] === undefined) throw new Error("entry has no `mode` binding");
  return m[1].trim();
}

let client = "";
let resume = "";
let builtClient = "";
let builtResume = "";

beforeAll(async () => {
  client = await entryText(fixture("client"));
  resume = await entryText(fixture("node"));
  builtClient = await builtEntryText(fixture("client"));
  builtResume = await builtEntryText(fixture("node"));
}, SLOW);
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe("k.runtime: the generated entries pass mode", () => {
  test("the generated client entry passes `mode` to `mount`", () => {
    expect(client).toMatch(/\bmount\s*\(\s*router\.App\s*,[^)]*\{[^}]*\bmode\b[^}]*\}/);
  });

  test("the generated client entry passes `mode` to `createRouter`", () => {
    expect(client).toMatch(/\bcreateRouter\s*\([^;]*\{[^}]*\bmode\b[^}]*\}/);
  });

  test("the generated resume entry passes `mode` to `resume`", () => {
    expect(resume).toMatch(/\bresume\s*\(\s*document\.body\s*,\s*components\s*,\s*\{[^}]*\bmode\b[^}]*\}/);
  });

  test('the served client entry holds `const mode = "dev"` and reads no `import.meta.env`', () => {
    expect(modeBinding(client)).toBe('"dev"');
    expect(client).not.toContain("import.meta.env");
  });

  test('the served resume entry holds `const mode = "dev"` and reads no `import.meta.env`', () => {
    expect(modeBinding(resume)).toBe('"dev"');
    expect(resume).not.toContain("import.meta.env");
  });

  test('the client entry under a Vite `build` holds `const mode = "production"` and reads no `import.meta.env`', () => {
    expect(modeBinding(builtClient)).toBe('"production"');
    expect(builtClient).not.toContain("import.meta.env");
  });

  test('the resume entry under a Vite `build` holds `const mode = "production"` and reads no `import.meta.env`', () => {
    expect(modeBinding(builtResume)).toBe('"production"');
    expect(builtResume).not.toContain("import.meta.env");
  });

  test('the unbundled `resumeEntry()` text holds `const mode = "production"` and reads no `import.meta.env`', () => {
    const text = resumeEntry();
    expect(modeBinding(text)).toBe('"production"');
    expect(text).not.toContain("import.meta.env");
  });
});

describe("k.runtime: the entries carry `dev` only when Vite's command is exactly `serve`", () => {
  const under = (command: string): Promise<string> => entryTextUnderCommand(fixture("client"), command);

  test(
    'the entry holds `const mode = "dev"` when the command Vite reports is `serve`',
    async () => {
      expect(modeBinding(await under("serve"))).toBe('"dev"');
    },
    SLOW,
  );

  test(
    'the entry holds `const mode = "production"` when Vite reports no command',
    async () => {
      expect(modeBinding(await under("undefined"))).toBe('"production"');
    },
    SLOW,
  );

  test.each(["build", "preview", "", "SERVE", "serve "])(
    'the entry holds `const mode = "production"` when the command is %j',
    async (command) => {
      expect(modeBinding(await under(command))).toBe('"production"');
    },
    SLOW,
  );
});
