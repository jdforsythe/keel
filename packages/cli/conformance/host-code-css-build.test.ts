// Spec: k.host-code, Conformance "The build of an app whose host element code file imports `./chart.css` emits it as a `.css` asset and inlines it in no document or chunk."
// Spec: k.host-code, Styles and policy "The build serves it from the app's origin and loads it with the code's chunk, which `style-src 'self'` allows."
// Seed: 1337 (no generated inputs). The real `keel build` over a temp project.
// Ambiguous: the build's output folder is not named in k.host-code; the test walks `dist` for built files.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, keel, materialize } from "./compat-support.ts";

const MARK = ".chart-marker-7f3a{color:currentcolor}";
const files = {
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['app'], adapter: 'client' } })\n",
  "modules/app/module.ts":
    "import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n",
  "modules/app/routes.ts": `import { manifest } from "@keel/router";\nimport Page from "./Page.tsx";\nexport const routes = manifest({ "app.home": { path: "/", component: Page } });\n`,
  "modules/app/Page.tsx": `import { Host } from "@keel/ui";\nimport { shape } from "./shape.schema.ts";\nexport default function Page() { return <Host id="app.chart" role="img" label="Chart" input={shape} value={{ n: 1 }} code={() => import("./chart.ts").then((m) => m.chart)} /> }\n`,
  "modules/app/shape.schema.ts": `import { s } from "@keel/schema";\nexport const shape = s.object({ n: s.number() });\n`,
  "modules/app/chart.ts": `import { hostCode } from "@keel/ui";\nimport "./chart.css";\nexport const chart = hostCode({ mount: (node: HTMLElement) => { node.dataset.drawn = "1"; } });\n`,
  "modules/app/chart.css": `${MARK}\n`,
};

const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

let dir = "";
beforeAll(() => {
  dir = materialize(files);
}, 120_000);
afterAll(() => {
  cleanup(dir);
});

describe("k.host-code: a host element code file's stylesheet", () => {
  it("the build emits `chart.css` as a `.css` asset and inlines it in no document or chunk", () => {
    const run = keel(dir, ["build"]);
    expect(run.status).toBe(0);
    const built = walk(join(dir, "dist"));
    const holding = built.filter((p) => readFileSync(p, "utf8").includes("chart-marker-7f3a"));
    expect(holding.length).toBeGreaterThan(0);
    expect(holding.every((p) => p.endsWith(".css"))).toBe(true);
  }, 120_000);
});
