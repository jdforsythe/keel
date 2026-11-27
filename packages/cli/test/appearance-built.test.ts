// @vitest-environment happy-dom
// Seed 1337 (no generated input: one fixture, one spawned build, one spawned server). k.schemes Choice: in the
// browser, `appearance(ctx)` knows the app's `choice` themes under every deployable kind. One project with a `client`
// deployable `web`, a `static` one `site` and a `node` one `api`, each page reading `appearance(ctx).theme()` and
// setting `slate` from a button; each built document is loaded into this DOM with its built script, and the click
// must make `theme()` `slate` and `<html>` carry `data-k-theme="slate"`.
import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { get } from "node:http";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, expect, test } from "vitest";
import { type Tree, cleanup, keel, materialize } from "../conformance/compat-support.ts";

const SLOW = fixedTime(300_000);
const SECRET = "appearance-built-secret-of-32-bytes-or-more";

const page = (m: string): string =>
  `import type { Ctx } from '@keel/ctx'\nimport { Box, Button, Text, appearance } from '@keel/ui'\nexport default function Page(_props: unknown, ctx: Ctx) {\n  const a = appearance(ctx)\n  return (\n    <Box id="${m}.page" as="main">\n      <Text id="${m}.theme">{a.theme()}</Text>\n      <Button id="${m}.pick" onClick={() => { a.set({ theme: 'slate' }) }}>Slate</Button>\n    </Box>\n  )\n}\n`;

const mod = (m: string, path: string): Tree => ({
  [`modules/${m}/module.ts`]: `import { module } from '@keel/compiler'\nexport default module({ id: '${m}', deps: [], capabilities: [], public: { exports: [] } })\n`,
  [`modules/${m}/${m}.contract.ts`]: `import { contract } from '@keel/router/contract'\nexport const ${m} = contract('${m}', { '${m}.home': { path: '${path}' } })\n`,
  [`modules/${m}/Page.tsx`]: page(m),
  [`modules/${m}/routes.ts`]: `import { manifest } from '@keel/router'\nimport Page from './Page.tsx'\nimport { ${m} } from './${m}.contract.ts'\nexport const routes = manifest(${m}, { '${m}.home': { component: Page } })\n`,
});

const tree: Tree = {
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0" })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "tokens.ts":
    'import { brandTokens } from "@keel/ui/brand";\nimport { defineTokens } from "@keel/ui/tokens";\n\n' +
    'export const tokens = defineTokens({ ...brandTokens, themes: { slate: { color: { accent: "#1f4e8c" } } } });\n',
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['w'], adapter: 'client' }, " +
    "site: { modules: ['s'], adapter: 'static' }, api: { modules: ['a'], adapter: 'node' } })\n",
  ...mod("w", "/"),
  ...mod("s", "/s"),
  ...mod("a", "/a"),
};

let dir = "";
let server: ChildProcess | undefined;
let origin = "";
beforeAll(async () => {
  dir = materialize(tree);
  const r = keel(dir, ["build"]);
  expect(r.status, JSON.stringify(r.records.filter((x) => x.kind === "diag"))).toBe(0);
  const child = spawn(process.execPath, [join(dir, "dist", "api", "server.mjs")], {
    cwd: join(dir, "dist", "api"),
    env: { ...process.env, PORT: "0", KEEL_SECRET: SECRET, KEEL_AGENT: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server = child;
  origin = await new Promise<string>((resolve, reject) => {
    let out = "";
    const timer = setTimeout(() => reject(new Error(`no listen line: ${out}`)), fixedTime(30_000));
    child.stdout?.on("data", (d: Buffer) => {
      out += d.toString("utf8");
      const port = /"port":(\d+)|port (\d+)/.exec(out);
      if (port !== null) {
        clearTimeout(timer);
        resolve(`http://127.0.0.1:${port[1] ?? port[2]}`);
      }
    });
    child.on("exit", (code) => reject(new Error(`server exited ${code}: ${out}`)));
  });
}, SLOW);
afterAll(() => {
  server?.kill("SIGTERM");
  cleanup(dir);
});

const fetchText = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    get(url, (res) => {
      let body = "";
      res.on("data", (d: Buffer) => {
        body += d.toString("utf8");
      });
      res.on("end", () => resolve(body));
    }).on("error", reject);
  });

/** Every file under `root`, recursively. */
const files = (root: string): string[] =>
  readdirSync(root).flatMap((n) => {
    const p = join(root, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });

/** Put `html` into this DOM and run the built script its `<script type="module" src>` names, found under `out`. */
async function load(html: string, out: string): Promise<void> {
  document.cookie = "keel-theme=; Path=/; Max-Age=0";
  const root = document.documentElement;
  for (const a of [...root.attributes]) root.removeAttribute(a.name);
  const src = /<script type="module"[^>]*src="([^"]+)"/.exec(html)?.[1];
  expect(src, "a module script").toBeDefined();
  const name = (src ?? "").split("?")[0]?.split("/").pop() ?? "";
  const file = files(out).find((f) => f.endsWith(`/${name}`) && f.endsWith(".js"));
  expect(file, `${name} under ${out}`).toBeDefined();
  root.innerHTML = html
    .replace(/^[\s\S]*?<html[^>]*>/, "")
    .replace(/<\/html>[\s\S]*$/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "");
  // The built script holds no import or export (one chunk), so it runs as a module body would, top-level await included.
  const AsyncFunction: new (body: string) => () => Promise<void> = Object.getPrototypeOf(async () => {}).constructor;
  await new AsyncFunction(`"use strict";\n${readFileSync(file ?? "", "utf8")}`)();
}

async function pick(m: string): Promise<void> {
  const text = (): string => document.getElementById(`${m}.theme`)?.textContent ?? "";
  expect(text()).toBe("default");
  document.getElementById(`${m}.pick`)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 0));
  expect(document.documentElement.getAttribute("data-k-theme")).toBe("slate");
  expect(text()).toBe("slate");
}

test(
  "a client deployable's appearance(ctx) knows its themes: theme() is default, set slate makes it slate",
  async () => {
    await load(readFileSync(join(dir, "dist", "web", "index.html"), "utf8"), join(dir, "dist", "web"));
    await pick("w");
  },
  SLOW,
);

test(
  "a static deployable's appearance(ctx) knows its themes in the browser",
  async () => {
    const doc = files(join(dir, "dist", "site")).find((f) => /[/\\]s(?:[/\\]index)?\.html$/.test(f)) ?? "";
    await load(readFileSync(doc, "utf8"), join(dir, "dist", "site"));
    await pick("s");
  },
  SLOW,
);

test(
  "a node deployable's appearance(ctx) knows its themes in the browser after resume",
  async () => {
    await load(await fetchText(`${origin}/a`), join(dir, "dist", "api"));
    await pick("a");
  },
  SLOW,
);
