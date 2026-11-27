// @vitest-environment happy-dom
// Spec: k.deploy, clause "`createApp({ assets })` on a `keel build` node fixture scripts a 200 JavaScript `resume` entry, `immutable`; no manifest: E1555." (RFC 0048)
// k.deploy Rules E1555
// k.head, Server "a `<link rel=\"stylesheet\">` for each `.css` file under `/assets/` that the build manifest's entry chunk names"
// Seed: 1337 (no generated inputs; the fixture is built once through the real CLI). In-process createApp, no listening server.
import { fixedTime } from "@keel/tooling/test-time";
import type { Ctx } from "@keel/ctx";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import type { RouteProps } from "@keel/router";
import { createApp, topology } from "@keel/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { childOutput } from "./topology-build-fixture.ts";

type Component = (props: RouteProps, ctx: Ctx) => Node;
type Fetcher = { fetch(req: Request): Promise<Response> };

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const COUNTER = `import { signal } from "@keel/reactive";
export default function Counter() {
  const n = signal(0);
  return <div><button id="c.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="c.out">{n.get()}</span></div>
}
`;

/** The file the fixture build compiles: the same counter from \`@keel/ui\` primitives, so the project passes \`keel check\`. */
const BUILT_COUNTER = `import { signal } from "@keel/reactive";
import { Box, Button, Text } from "@keel/ui";
export default function Counter() {
  const n = signal(0);
  return <Box p="4"><Button id="c.inc" onClick={() => n.set(n.get() + 1)}>+</Button><Text id="c.out">{n.get()}</Text></Box>
}
`;

function compileComponent(source: string): Component {
  const r = compile([{ path: "Counter.tsx", source }]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return (props, ctx) => {
    const node: unknown = fn(props, ctx);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}

function write(root: string, rel: string, content: string): void {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function link(target: string, at: string): void {
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.symlinkSync(target, at);
}

const tmpRoots: string[] = [];
function tmp(prefix: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  tmpRoots.push(dir);
  return dir;
}

let fixture = "";
let emptyDir = "";

beforeAll(() => {
  fixture = tmp("keel-build-");
  emptyDir = tmp("keel-noassets-");
  for (const p of ["compiler", "ctx", "reactive", "router", "runtime-dom", "schema", "store", "server", "ui"]) {
    link(path.join(REPO, "packages", p), path.join(fixture, "node_modules", "@keel", p));
  }
  link(path.join(REPO, "node_modules", "vite"), path.join(fixture, "node_modules", "vite"));
  link("../vite/bin/vite.js", path.join(fixture, "node_modules", ".bin", "vite"));
  write(fixture, "package.json", `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`);
  write(
    fixture,
    "topology.ts",
    'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["app"], adapter: "node" } });\n',
  );
  write(
    fixture,
    "vite.config.ts",
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  );
  write(
    fixture,
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
  write(fixture, "modules/app/Counter.tsx", BUILT_COUNTER);
  write(
    fixture,
    "modules/app/module.ts",
    'import { module } from "@keel/compiler";\nexport default module({ id: "app", deps: [], capabilities: [], public: { exports: [] } });\n',
  );
  write(
    fixture,
    "tokens.ts",
    'import { defineTokens } from "@keel/ui";\nimport { brandTokens } from "@keel/ui/brand";\nexport const tokens = defineTokens({ ...brandTokens });\n',
  );
  write(
    fixture,
    "modules/app/routes.ts",
    'import { manifest } from "@keel/router";\nimport { app } from "./app.contract.ts";\nimport Counter from "./Counter.tsx";\nexport const routes = manifest(app, { "app.home": { component: Counter } });\n',
  );
  write(
    fixture,
    "modules/app/app.contract.ts",
    'import { contract } from "@keel/router/contract";\nexport const app = contract("app", { "app.home": { path: "/" } });\n',
  );
  const r = spawnSync(process.execPath, [path.join(REPO, "packages", "cli", "src", "bin.ts"), "build"], {
    cwd: fixture,
    encoding: "utf8",
    env: { ...process.env, KEEL_AGENT: "1" },
  });
  if (r.status !== 0) {
    throw new Error(`keel build failed (status ${String(r.status)}): ${childOutput(r)}`);
  }
}, fixedTime(90_000));

afterAll(() => {
  for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true });
});

async function appFor(assets: string, mode?: "dev" | "production"): Promise<Fetcher> {
  const appContract = contract("app", { "app.home": { path: "/" } });
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(appContract, { "app.home": { component: compileComponent(COUNTER) } }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    assets,
    ...(mode === undefined ? {} : { mode }),
  });
}

async function moduleSrc(app: Fetcher): Promise<string> {
  const res = await app.fetch(new Request("http://localhost/"));
  expect(res.status).toBe(200);
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  const scripts = doc.querySelectorAll('script[type="module"]');
  expect(scripts).toHaveLength(1);
  const src = scripts[0]?.getAttribute("src");
  if (src === null || src === undefined) throw new Error("module script has no src");
  return src;
}

describe("k.deploy: createApp({ assets }) on a keel build node fixture", () => {
  it("createApp({ assets }) on a keel build node fixture scripts a 200 JavaScript resume entry, immutable", async () => {
    expect(fs.existsSync(path.join(fixture, "dist", "web", ".vite", "manifest.json"))).toBe(true);
    const app = await appFor(path.join(fixture, "dist", "web"));
    const src = await moduleSrc(app);
    expect(src.startsWith("/assets/")).toBe(true);
    const res = await app.fetch(new Request(new URL(src, "http://localhost")));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("javascript");
    expect(res.headers.get("cache-control") ?? "").toContain("immutable");
    expect(await res.text()).toContain("resume");
  });

  it("HEAD of the built entry answers 200 with an empty body", async () => {
    const app = await appFor(path.join(fixture, "dist", "web"));
    const src = await moduleSrc(app);
    const res = await app.fetch(new Request(new URL(src, "http://localhost"), { method: "HEAD" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("E1555: production createApp with assets lacking a manifest rejects", async () => {
    await expect(appFor(emptyDir)).rejects.toThrow(/^E1555/);
  });

  it("in dev mode assets is ignored and the document script is /@keel/entry.ts", async () => {
    const app = await appFor(emptyDir, "dev");
    expect(await moduleSrc(app)).toBe("/@keel/entry.ts");
  });

  it("a built node-only deployable (a node deployable and no client one) links a stylesheet under /assets/ that the manifest's entry chunk names, and it serves as 200 CSS", async () => {
    const app = await appFor(path.join(fixture, "dist", "web"));
    const res = await app.fetch(new Request("http://localhost/"));
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const hrefs = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.getAttribute("href") ?? "");
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith("/assets/") && href.endsWith(".css")).toBe(true);
      const css = await app.fetch(new Request(new URL(href, "http://localhost")));
      expect(css.status).toBe(200);
      expect(css.headers.get("content-type") ?? "").toContain("css");
      expect((await css.text()).length).toBeGreaterThan(0);
    }
  });
});
