// Spec: std.messages, clause "A `client` build of a fixture route whose loader loads a set holds each locale's entry in its own chunk, and no other chunk holds an entry's text."
// Seed 1337 (no random inputs; the fixture is built once through the real CLI, as packages/server/conformance/build-assets.test.ts).
// Observed from the public API through `keel build` output: the JS files under dist/. A locale's entry text is a marker string unique
// to that locale file, so "holds the entry" is "contains the marker". `keel build` builds a client-only topology with the project's
// own Vite build (k.server Build), so the fixture carries an index.html whose entry script imports the routes, and the output is dist/.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, test } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");
const MARKERS = { "en-US": "MARK-EN-7f3a-recipes", "de-DE": "MARK-DE-7f3a-rezepte" } as const;

const roots: string[] = [];
let dist = "";

function write(root: string, rel: string, content: string): void {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function link(target: string, at: string): void {
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.symlinkSync(target, at);
}
function jsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".js"));
}

beforeAll(() => {
  const fx = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-msg-")));
  roots.push(fx);
  for (const p of [
    "compiler",
    "ctx",
    "reactive",
    "router",
    "runtime-dom",
    "schema",
    "server",
    "std-i18n",
    "std-messages",
  ]) {
    link(path.join(REPO, "packages", p), path.join(fx, "node_modules", "@keel", p));
  }
  link(path.join(REPO, "node_modules", "vite"), path.join(fx, "node_modules", "vite"));
  link("../vite/bin/vite.js", path.join(fx, "node_modules", ".bin", "vite"));
  write(fx, "package.json", `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`);
  write(
    fx,
    "topology.ts",
    'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["app"], adapter: "client" } });\n',
  );
  write(
    fx,
    "index.html",
    '<!doctype html>\n<html lang="en"><head><title>fx</title></head><body><div id="app"></div><script type="module" src="/main.ts"></script></body></html>\n',
  );
  write(fx, "main.ts", 'import { routes } from "./modules/app/routes.ts";\nObject.assign(globalThis, { routes });\n');
  write(
    fx,
    "vite.config.ts",
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  );
  write(
    fx,
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
        jsxImportSource: "@keel/runtime-dom",
        module: "esnext",
        target: "es2022",
        moduleResolution: "bundler",
      },
    }),
  );
  write(
    fx,
    "modules/app/AppLocale.schema.ts",
    'import { s } from "@keel/schema";\nexport const AppLocale = s.enum(["en-US", "de-DE"]);\n',
  );
  write(
    fx,
    "modules/app/Page.schema.ts",
    `import { messages } from "@keel/std-messages";
import { AppLocale } from "./AppLocale.schema.ts";
export const Page = messages(AppLocale, { title: {} }, (locale) => import(\`./Page/\${locale}.ts\`));
`,
  );
  for (const [locale, marker] of Object.entries(MARKERS)) {
    write(
      fx,
      `modules/app/Page/${locale}.ts`,
      `import { Page } from "../Page.schema.ts";\nexport default Page.text({ title: "${marker}" });\n`,
    );
  }
  write(
    fx,
    "modules/app/PageView.tsx",
    "export default function PageView(props) {\n  return <h1>{props.data.text.title}</h1>\n}\n",
  );
  write(
    fx,
    "modules/app/routes.ts",
    `import { loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { AppLocale } from "./AppLocale.schema.ts";
import { Page } from "./Page.schema.ts";
import PageView from "./PageView.tsx";
const Params = s.object({ locale: AppLocale });
const pageLoader = loader({ output: s.object({ text: Page }), params: Params }, async ({ params }) => ok({ text: await Page.load(params.locale) }));
export const routes = manifest({ "app.page": { path: "/:locale", params: Params, component: PageView, loader: pageLoader } });
`,
  );
  const r = spawnSync(process.execPath, [path.join(REPO, "packages", "cli", "src", "bin.ts"), "build"], {
    cwd: fx,
    encoding: "utf8",
    env: { ...process.env, KEEL_AGENT: "1" },
  });
  if (r.status !== 0)
    throw new Error(`keel build failed (status ${String(r.status)})\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  dist = path.join(fx, "dist");
}, 120_000);

afterAll(() => {
  for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true });
});

test("A `client` build of a fixture route whose loader loads a set holds each locale's entry in its own chunk, and no other chunk holds an entry's text.", () => {
  const files = jsFiles(dist);
  expect(files.length).toBeGreaterThan(0);
  const holders = (marker: string) => files.filter((f) => fs.readFileSync(path.join(dist, f), "utf8").includes(marker));
  const en = holders(MARKERS["en-US"]);
  const de = holders(MARKERS["de-DE"]);
  expect(en).toHaveLength(1);
  expect(de).toHaveLength(1);
  expect(en[0]).not.toBe(de[0]);
});
