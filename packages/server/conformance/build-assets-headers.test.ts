// Spec: k.deploy, clause "Built files are `nosniff`, unhashed ones `no-cache`; a symlink out of `assets/` is not served."
// Spec: k.deploy Rules E1555 (a manifest entry whose file escapes the build dir)
// Seed: 1337 (no generated inputs). The dist/web fixture is hand-built in a realpath'd tmp dir; `keel build` is not run.
// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { createApp, topology } from "@keel/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Fetcher = { fetch(req: Request): Promise<Response> };

const SECRET_TEXT = "TOP-SECRET-OUTSIDE-CONTENT-9f8e7d6c";
const MANIFEST_TEXT = JSON.stringify({
  "entry.ts": {
    file: "assets/entry-B1x2Y3z4.js",
    isEntry: true,
    css: ["assets/entry-Ab12Cd34.css"],
    assets: ["assets/caf\u00e9-Ab12Cd34.png"],
  },
  "island.ts": { file: "assets/island-checkout.js" },
});
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const roots: string[] = [];
let dist = "";
let app: Fetcher;

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function tmp(prefix: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  roots.push(dir);
  return dir;
}

async function appFor(assets: string): Promise<Fetcher> {
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest({ "app.home": { path: "/", component: () => document.createElement("p") } }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
    assets,
  });
}

const get = (url: string): Promise<Response> => app.fetch(new Request(`http://localhost${url}`));

beforeAll(async () => {
  const root = tmp("keel-assets-headers-");
  dist = path.join(root, "dist", "web");
  write(path.join(dist, ".vite", "manifest.json"), MANIFEST_TEXT);
  write(path.join(dist, "assets", "entry-B1x2Y3z4.js"), "export const resume = 1;\n");
  write(path.join(dist, "assets", "entry-Ab12Cd34.css"), "body{margin:0}\n");
  write(path.join(dist, "assets", "robots.txt"), "User-agent: *\n");
  write(path.join(dist, "assets", "logo.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>\n");
  write(path.join(dist, "assets", "stray-Zz99Yy88.js"), "export const stray = 1;\n");
  write(path.join(dist, "assets", "island-checkout.js"), "export const island = 1;\n");
  fs.writeFileSync(path.join(dist, "assets", "caf\u00e9-Ab12Cd34.png"), PNG_BYTES);
  write(path.join(root, "outside", "secret.js"), SECRET_TEXT);
  fs.symlinkSync(path.join(root, "outside", "secret.js"), path.join(dist, "assets", "leak.js"));
  fs.symlinkSync(path.join(root, "outside"), path.join(dist, "assets", "linked"));
  fs.symlinkSync("entry-B1x2Y3z4.js", path.join(dist, "assets", "alias-B1x2Y3z4.js"));
  app = await appFor(dist);
});

afterAll(() => {
  for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true });
});

describe("k.deploy: built files are nosniff, unhashed ones no-cache; a symlink out of assets/ is not served", () => {
  it("manifest-named hashed files are 200, nosniff and immutable (entry and css)", async () => {
    for (const url of ["/assets/entry-B1x2Y3z4.js", "/assets/entry-Ab12Cd34.css"]) {
      const res = await get(url);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("cache-control") ?? "").toContain("immutable");
    }
  });

  it("backlog 0136: an unhashed asset is not immutable", async () => {
    for (const url of ["/assets/robots.txt", "/assets/logo.svg", "/assets/stray-Zz99Yy88.js"]) {
      const res = await get(url);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      const cc = res.headers.get("cache-control") ?? "";
      expect(cc).toContain("no-cache");
      expect(cc).not.toContain("immutable");
    }
  });

  it("a hash-like file name that the manifest does not name is no-cache", async () => {
    const res = await get("/assets/stray-Zz99Yy88.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control") ?? "").toContain("no-cache");
    expect(res.headers.get("cache-control") ?? "").not.toContain("immutable");
  });

  it("backlog 0161: a manifest file without a hash in its name (island-checkout.js) is no-cache", async () => {
    const res = await get("/assets/island-checkout.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control") ?? "").toContain("no-cache");
    expect(res.headers.get("cache-control") ?? "").not.toContain("immutable");
    const etag = res.headers.get("etag");
    expect(etag).not.toBeNull();
    const again = await app.fetch(
      new Request("http://localhost/assets/island-checkout.js", { headers: { "if-none-match": etag ?? "" } }),
    );
    expect(again.status).toBe(304);
    expect(again.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await again.text()).toBe("");
  });

  it("backlog 0161: a non-ASCII asset serves at its percent-encoded path", async () => {
    const res = await get("/assets/caf%C3%A9-Ab12Cd34.png");
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it("backlog 0136: a symlink out of assets/ is not served", async () => {
    for (const url of ["/assets/leak.js", "/assets/linked/secret.js"]) {
      const res = await get(url);
      expect(res.status).not.toBe(200);
      expect(await res.text()).not.toContain(SECRET_TEXT);
    }
  });

  it("a path escaping assets/ never returns the build manifest", async () => {
    for (const url of [
      "/assets/../.vite/manifest.json",
      "/assets/%2e%2e/.vite/manifest.json",
      "/assets/..%2f.vite/manifest.json",
    ]) {
      const res = await get(url);
      const text = await res.text();
      expect(text).not.toContain("entry-B1x2Y3z4.js");
      expect(text).not.toContain('"isEntry"');
    }
  });

  it("E1555: a manifest whose entry file escapes the build dir rejects", async () => {
    const root = tmp("keel-assets-escape-");
    const bad = path.join(root, "dist", "web");
    write(path.join(bad, ".vite", "manifest.json"), `{"entry.ts":{"file":"../outside/secret.js","isEntry":true}}`);
    write(path.join(root, "dist", "outside", "secret.js"), SECRET_TEXT);
    await expect(appFor(bad)).rejects.toThrow(/^E1555/);
  });
});
