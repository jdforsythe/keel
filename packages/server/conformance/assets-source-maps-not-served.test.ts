// Spec: k.deploy, Assets paragraph "Production `createApp({ assets: 'dist/<name>' })` loads the client" (first eight words); rfc:0155 states the `*.map` exclusion there.
// Seed: none (no generated inputs). The dist/web fixture is hand-built in a realpath'd tmp dir; `keel build` is not run.
// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { createApp, topology } from "@keel/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Fetcher = { fetch(req: Request): Promise<Response> };

const MAPPINGS = "AAAA,SAASA,MAAMC;MAGZ-MAPPINGS-9f8e7d6c";
const SOURCE = "const SOURCES_CONTENT_SECRET_4b3a2f1e = 1; // unminified comment";
const MAP_TEXT = JSON.stringify({
  version: 3,
  sources: ["src/entry.ts"],
  sourcesContent: [SOURCE],
  mappings: MAPPINGS,
});
const MANIFEST_TEXT = JSON.stringify({
  "entry.ts": {
    file: "assets/entry-B1x2Y3z4.js",
    isEntry: true,
    css: ["assets/nested/x-Ab12Cd34.css"],
    assets: ["assets/chunk-Qq77Ww66.js.map"],
  },
});
const MAP_URLS = [
  "/assets/entry-B1x2Y3z4.js.map",
  "/assets/nested/x-Ab12Cd34.css.map",
  "/assets/chunk-Qq77Ww66.js.map",
];
const roots: string[] = [];
let app: Fetcher;

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const get = (url: string, method = "GET"): Promise<Response> =>
  app.fetch(new Request(`http://localhost${url}`, { method }));

beforeAll(async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-assets-maps-")));
  roots.push(root);
  const dist = path.join(root, "dist", "web");
  write(path.join(dist, ".vite", "manifest.json"), MANIFEST_TEXT);
  write(
    path.join(dist, "assets", "entry-B1x2Y3z4.js"),
    "export const resume = 1;\n//# sourceMappingURL=entry-B1x2Y3z4.js.map\n",
  );
  write(path.join(dist, "assets", "nested", "x-Ab12Cd34.css"), "body{margin:0}\n");
  write(path.join(dist, "assets", "chunk-Qq77Ww66.js"), "export const chunk = 1;\n");
  write(path.join(dist, "assets", "robots.txt"), "User-agent: *\n");
  for (const url of MAP_URLS) write(path.join(dist, url), MAP_TEXT);
  const appContract = contract("app", { "app.home": { path: "/" } });
  app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(appContract, { "app.home": { component: () => document.createElement("p") } }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
    assets: dist,
  });
});

afterAll(() => {
  for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true });
});

describe("k.deploy Assets: serves /assets/* but *.map (rfc:0155)", () => {
  it("rfc:0155: GET of assets/entry-<hash>.js is 200", async () => {
    const res = await get("/assets/entry-B1x2Y3z4.js");
    expect(res.status).toBe(200);
  });

  it("rfc:0155: GET of assets/entry-<hash>.js.map is 404 and its body holds neither mappings nor sourcesContent", async () => {
    const res = await get("/assets/entry-B1x2Y3z4.js.map");
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).not.toContain(MAPPINGS);
    expect(text).not.toContain("SOURCES_CONTENT_SECRET_4b3a2f1e");
  });

  it("rfc:0155: a map one folder down (assets/nested/x-<hash>.css.map) is 404 and leaks nothing, its css is 200", async () => {
    expect((await get("/assets/nested/x-Ab12Cd34.css")).status).toBe(200);
    const res = await get("/assets/nested/x-Ab12Cd34.css.map");
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).not.toContain(MAPPINGS);
    expect(text).not.toContain("SOURCES_CONTENT_SECRET_4b3a2f1e");
  });

  it("rfc:0155: a map the manifest names in a chunk's assets is 404 and leaks nothing", async () => {
    expect((await get("/assets/chunk-Qq77Ww66.js")).status).toBe(200);
    const res = await get("/assets/chunk-Qq77Ww66.js.map");
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).not.toContain(MAPPINGS);
    expect(text).not.toContain("SOURCES_CONTENT_SECRET_4b3a2f1e");
  });

  it("rfc:0155: a HEAD of a map is 404", async () => {
    for (const url of MAP_URLS) expect((await get(url, "HEAD")).status).toBe(404);
  });

  it("rfc:0155: every other file of the build is still served nosniff", async () => {
    for (const url of [
      "/assets/entry-B1x2Y3z4.js",
      "/assets/nested/x-Ab12Cd34.css",
      "/assets/chunk-Qq77Ww66.js",
      "/assets/robots.txt",
    ]) {
      const res = await get(url);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });
});
