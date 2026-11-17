// Spec: k.runtime API, clause "`mount(Component, el, { ctx?, onError?, mode? })` ... Both take `mode` (k.errors): `'dev'` in a dev build, else `'production'`."
// Spec: k.runtime Islands: the generated resume entry calls `resume(document.body, components, { ctx, stores, mode })`.
// Seed: 1337 (no random input: the `import.meta.env.DEV` values are enumerated).
// The entries are read as the Vite dev server serves `/@keel/entry.ts` for a fixture app; the `mode` expression is evaluated with `import.meta.env` bound to a stand-in.
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const SLOW = 180_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;

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
    "import { manifest } from '@keel/router'\nconst Page = () => null\nexport const routes = manifest({ 'c.page': { path: '/', component: Page } })\n",
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

/** Evaluate the `mode` binding of an entry with `import.meta.env` replaced by `env`. */
function modeWith(code: string, env: unknown): unknown {
  const m = /(?:const|let|var)\s+mode\s*=\s*([^;\n]+)/.exec(code);
  if (m === null || m[1] === undefined) throw new Error("entry has no `mode` binding");
  const expr = m[1].replace(/import\.meta\.env/g, "__env");
  return new Function("__env", `return (${expr});`)(env);
}

let client = "";
let resume = "";

beforeAll(async () => {
  client = await entryText(fixture("client"));
  resume = await entryText(fixture("node"));
}, SLOW);
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe("k.runtime: the generated entries pass mode", () => {
  test("the generated client entry passes `mode` to `mount`", () => {
    expect(client).toMatch(/\bmount\s*\(\s*router\.App\s*,[^)]*\{[^}]*\bmode\b[^}]*\}/);
  });

  test("the generated resume entry passes `mode` to `resume`", () => {
    expect(resume).toMatch(/\bresume\s*\(\s*document\.body\s*,\s*components\s*,\s*\{[^}]*\bmode\b[^}]*\}/);
  });

  test('evaluated with `import.meta.env.DEV` true the client entry\'s mode is "dev"', () => {
    expect(modeWith(client, { DEV: true })).toBe("dev");
  });

  test('evaluated with `import.meta.env.DEV` not true the client entry\'s mode is "production"', () => {
    for (const env of [{ DEV: false }, {}, { DEV: "true" }, undefined]) {
      expect(modeWith(client, env)).toBe("production");
    }
  });

  test('evaluated with `import.meta.env.DEV` true the resume entry\'s mode is "dev"', () => {
    expect(modeWith(resume, { DEV: true })).toBe("dev");
  });

  test('evaluated with `import.meta.env.DEV` not true, or with no `import.meta.env`, the resume entry\'s mode is "production"', () => {
    for (const env of [{ DEV: false }, {}, { DEV: "true" }, undefined]) {
      expect(modeWith(resume, env)).toBe("production");
    }
  });
});
