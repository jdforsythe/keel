// @vitest-environment node
// topology.ts names `api` as the host of `web` (k.hosting): over a client build in `assets`, the `api` app answers a
// document request that matches none of its routes with the client's index.html, and its own API routes still win.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { createApp } from "@keel/server";
import { afterAll, describe, expect, it } from "vitest";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";

const INDEX = '<!doctype html><html><head><title>todos</title></head><body><div id="app"></div></body></html>';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "golden-1-host-"));
fs.mkdirSync(path.join(dir, ".vite"));
fs.mkdirSync(path.join(dir, "assets"));
fs.writeFileSync(path.join(dir, "index.html"), INDEX);
fs.writeFileSync(path.join(dir, "assets", "entry-abcd1234.js"), "export {};");
fs.writeFileSync(
  path.join(dir, ".vite", "manifest.json"),
  JSON.stringify({ "entry.ts": { file: "assets/entry-abcd1234.js", isEntry: true } }),
);
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const app = () =>
  createApp({
    topology,
    routes: apiRoutes,
    ctx: createCtx({ mode: "sim", seed: 7 }),
    deployable: "api",
    assets: dir,
    secret: "s".repeat(32),
  });
const get = (a: Awaited<ReturnType<typeof app>>, p: string, accept: string) =>
  a.fetch(new Request(`http://localhost${p}`, { headers: { accept } }));

describe("golden-1 api hosts the web client", () => {
  it("answers / and a path that is no route with index.html, and keeps its API routes", async () => {
    const a = await app();
    for (const p of ["/", "/lists/l1"]) {
      const res = await get(a, p, "text/html");
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-cache");
      expect(await res.text()).toBe(INDEX);
    }
    const lists = await get(a, "/api/lists", "application/json");
    expect(lists.status).toBe(200);
    expect(lists.headers.get("content-type")).toContain("application/json");
  });

  it("serves a hashed asset as immutable", async () => {
    const a = await app();
    const asset = await get(a, "/assets/entry-abcd1234.js", "*/*");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("cache-control")).toContain("immutable");
  });
});
