// A `*.map` file under `assets/` is never read, so no spelling of its path reaches it.
import fs from "node:fs";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/createApp.ts";
import { topology } from "../src/topology.ts";

const SECRET = "MAP_SOURCES_SECRET_77aa";
const c = contract("app", { "app.home": { path: "/" } });
let root = "";
let app: { fetch(req: Request): Promise<Response> };

beforeAll(async () => {
  root = fs.realpathSync(tempDir("keel-map-paths-"));
  const files: Record<string, string> = {
    ".vite/manifest.json": JSON.stringify({ e: { file: "assets/entry-Ab12Cd34.js", isEntry: true } }),
    "assets/entry-Ab12Cd34.js": "resume()\n",
    "assets/entry-Ab12Cd34.js.map": SECRET,
    "assets/upper-Ab12Cd34.js.MAP": SECRET,
  };
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(c, { "app.home": { component: () => document.createElement("p") } }),
    ctx: createCtx({ mode: "sim", seed: 1 }),
    mode: "production",
    assets: root,
  });
});

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe("a map is not reached by any spelling of its path", () => {
  it.each([
    "/assets/entry-Ab12Cd34.js.map",
    "/assets/entry-Ab12Cd34.js%2emap",
    "/assets/entry-Ab12Cd34.js%2Emap",
    "/assets/entry-Ab12Cd34.js.ma%70",
    "/assets/entry-Ab12Cd34.js.map%00",
    "/assets/entry-Ab12Cd34.js.map/",
    "/assets/entry-Ab12Cd34.js.map?x=1",
    "/assets/entry-Ab12Cd34.js.map#frag",
    "/assets/./entry-Ab12Cd34.js.map",
    "/assets/nested/../entry-Ab12Cd34.js.map",
    "/assets/entry-Ab12Cd34.js.map%2F",
  ])("%s is not served", async (url) => {
    for (const method of ["GET", "HEAD"]) {
      const res = await app.fetch(new Request(`http://localhost${url}`, { method }));
      expect(res.status).not.toBe(200);
      expect(await res.text()).not.toContain(SECRET);
    }
  });

  it("the js beside the map is served", async () => {
    expect((await app.fetch(new Request("http://localhost/assets/entry-Ab12Cd34.js"))).status).toBe(200);
  });
});

describe("a map in any letter case is not served", () => {
  it("GET of a .MAP file is 404 and holds none of its text", async () => {
    const res = await app.fetch(new Request("http://localhost/assets/upper-Ab12Cd34.js.MAP"));
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain(SECRET);
  });
});
