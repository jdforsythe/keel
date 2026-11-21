// @vitest-environment happy-dom
// Spec: k.hosting, clause "With `KEEL_PEER_API=https://api.test` the built `index.html` has one `keel-peer` tag for `api`, and a `service({ contract })` call from the client entry under a sim ctx fetches `https://api.test` plus the path with credentials included; unset, the call goes to the document's origin; `KEEL_PEER_API=nope` fails the build with one E1565 naming the key."
// Seed: none (fixed fixtures, no random input).
// The built client entry runs in happy-dom: the built `index.html`'s `keel-peer` tags are placed in the document, `globalThis.fetch` is a recorder, the entry is
// run, and its page calls `service({ contract: api })` with the `ctx` it is given (a component's second argument, k.runtime). What the recorder saw is the observation.
// ASSUMED: the entry's `ctx` sends a request through the page's `globalThis.fetch` (k.services: `ctx.net.fetch`; k.persist's browser net driver) and the router passes the
// entry's `ctx` to a page component as its second argument.
// ASSUMED: the unset call is sent without `credentials: 'include'` (the spec names the flag only for another origin).
// ASSUMED: the call is a GET `/api/ping` and the answer's body is not read by the assertions (the recorder answers 200 with an empty JSON object).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Environment for the build: the parent's without the vitest and KEEL_ keys, plus `extra`. */
function deployEnv(extra: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST" || k.startsWith("KEEL_"))
      continue;
    env[k] = v;
  }
  return { ...env, ...extra };
}

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

function write(root: string, rel: string, content: string): void {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function link(target: string, at: string): void {
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.symlinkSync(target, at);
}

const PAGE = `import type { Ctx } from "@keel/ctx";
import { service } from "@keel/services";
import { Box, Text } from "@keel/ui";
import { api as apiContract } from "../api/api.contract.ts";
const api = service({ contract: apiContract });
export default function Page(_props: unknown, ctx: Ctx) {
  void api.ping({}, ctx);
  return <Box as="main"><Text>web</Text></Box>;
}
`;

function build(env: Record<string, string>): { root: string; status: number | null } {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-peer-")));
  roots.push(root);
  for (const p of [
    "compiler",
    "ctx",
    "reactive",
    "router",
    "runtime-dom",
    "schema",
    "services",
    "store",
    "server",
    "ui",
  ]) {
    link(path.join(REPO, "packages", p), path.join(root, "node_modules", "@keel", p));
  }
  link(path.join(REPO, "node_modules", "vite"), path.join(root, "node_modules", "vite"));
  link("../vite/bin/vite.js", path.join(root, "node_modules", ".bin", "vite"));
  write(root, "package.json", `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`);
  write(
    root,
    "topology.ts",
    `import { topology } from "@keel/server";\nexport default topology({ api: { modules: ["api"], adapter: "node" }, web: { modules: ["app"], adapter: "client" } });\n`,
  );
  write(
    root,
    "vite.config.ts",
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  );
  write(
    root,
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
  write(root, "modules/app/Page.tsx", PAGE);
  write(
    root,
    "modules/app/module.ts",
    'import { module } from "@keel/compiler";\nexport default module({ id: "app", deps: ["api"], capabilities: [], public: { exports: [] } });\n',
  );
  write(
    root,
    "modules/app/routes.ts",
    'import { manifest } from "@keel/router";\nimport { app } from "./app.contract.ts";\nimport Page from "./Page.tsx";\nexport const routes = manifest(app, { "app.home": { component: Page } });\n',
  );
  write(
    root,
    "modules/app/app.contract.ts",
    'import { contract } from "@keel/router/contract";\nexport const app = contract("app", { "app.home": { path: "/" } });\n',
  );
  write(
    root,
    "modules/api/module.ts",
    'import { module } from "@keel/compiler";\nexport default module({ id: "api", deps: [], capabilities: [], public: { exports: [] } });\n',
  );
  write(
    root,
    "modules/api/routes.ts",
    'import { manifest } from "@keel/router";\nimport { api } from "./api.contract.ts";\nimport { ping } from "./ping.server.ts";\nexport const routes = manifest(api, { "api.ping": { loader: ping } });\n',
  );
  write(
    root,
    "modules/api/api.contract.ts",
    'import { contract } from "@keel/router/contract";\nimport { s } from "@keel/schema";\nexport const api = contract("api", { "api.ping": { method: "GET", path: "/api/ping", output: s.object({ n: s.int() }) } });\n',
  );
  write(
    root,
    "modules/api/ping.server.ts",
    'import { loader } from "@keel/router";\nimport { ok } from "@keel/schema";\nimport { api } from "./api.contract.ts";\nexport const ping = loader(api, "api.ping", {}, async () => ok({ n: 1 }));\n',
  );
  const r = spawnSync(process.execPath, [path.join(REPO, "packages", "cli", "src", "bin.ts"), "build"], {
    cwd: root,
    encoding: "utf8",
    env: deployEnv({ KEEL_AGENT: "1", ...env }),
  });
  return { root, status: r.status };
}

interface Seen {
  url: string;
  credentials: string | undefined;
}

/** Place the built `index.html` in the document, record `fetch`, import the built entry, and return the requests it made. */
async function run(root: string, pageOrigin: string): Promise<Seen[]> {
  const html = fs.readFileSync(path.join(root, "dist", "web", "index.html"), "utf8");
  const tags = html.match(/<meta\b[^>]*name="keel-peer"[^>]*>/g) ?? [];
  const entry = /<script\b[^>]*type="module"[^>]*src="([^"]+)"/.exec(html)?.[1];
  expect(entry).toBeDefined();
  const dom: unknown = Reflect.get(window, "happyDOM");
  const setURL = typeof dom === "object" && dom !== null ? Reflect.get(dom, "setURL") : undefined;
  expect(typeof setURL).toBe("function");
  if (typeof setURL === "function") Reflect.apply(setURL, dom, [pageOrigin]);
  document.head.innerHTML = tags.join("");
  document.body.innerHTML = '<div id="app"></div>';
  const seen: Seen[] = [];
  globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    seen.push({ url: req.url, credentials: init?.credentials ?? req.credentials });
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  const file = path.join(root, "dist", "web", String(entry).replace(/^\//, ""));
  // The bundle is one self-contained script; running it is what the browser does with the `<script type="module">`.
  new Function(fs.readFileSync(file, "utf8"))();
  for (let i = 0; i < 200 && seen.length === 0; i++) await Promise.resolve();
  return seen;
}

describe("k.hosting: the client entry binds keel-peer tags to its ctx", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  test("With `KEEL_PEER_API=https://api.test` a `service({ contract })` call from the client entry fetches `https://api.test` plus the path with credentials included", async () => {
    const { root, status } = build({ KEEL_PEER_API: "https://api.test" });
    expect(status).toBe(0);
    const seen = await run(root, "https://web.test/");
    expect(seen.length).toBeGreaterThan(0);
    for (const r of seen) {
      expect(r.url.startsWith("https://api.test/api/ping")).toBe(true);
      expect(r.credentials).toBe("include");
    }
  }, 180_000);

  test("With `KEEL_PEER_API` unset a `service({ contract })` call from the client entry goes to the document's origin, without credentials included", async () => {
    const { root, status } = build({});
    expect(status).toBe(0);
    const html = fs.readFileSync(path.join(root, "dist", "web", "index.html"), "utf8");
    expect(html).not.toContain('name="keel-peer"');
    const seen = await run(root, "https://web.test/");
    expect(seen.length).toBeGreaterThan(0);
    for (const r of seen) {
      expect(r.url.startsWith("https://web.test/api/ping")).toBe(true);
      expect(r.credentials).not.toBe("include");
    }
  }, 180_000);
});
