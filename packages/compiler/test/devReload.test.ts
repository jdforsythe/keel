// `keel dev` (k.topology Local topology): a changed app source closes the dev apps and the next request loads them
// again. The next apps load only once the old ones have closed, so two generations never share storage (a leased
// job runs once).
import fs from "node:fs";
import http from "node:http";
import { Socket } from "node:net";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, expect, it } from "vitest";

let root = "";
beforeEach(() => {
  root = tempDir(".tmp-devreload-", import.meta.dirname);
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const ticks = async (): Promise<void> => {
  for (let i = 0; i < 50; i++) await Promise.resolve();
};

it("loads the next dev apps only after the old ones have closed", async () => {
  fs.writeFileSync(path.join(root, "topology.ts"), `export default { api: { modules: ["a"], adapter: "node" } };\n`);
  const events: string[] = [];
  let release = (): void => {};
  let loads = 0;
  const app = (n: number) => ({
    fetch: () => Promise.resolve(new Response(null)),
    close: () => {
      events.push(`close ${n}`);
      return new Promise<void>((resolve) => {
        release = () => {
          events.push(`closed ${n}`);
          resolve();
        };
      });
    },
  });
  const p = keel();
  p.configResolved({ root });
  const used: Parameters<Parameters<typeof p.configurePreviewServer>[0]["middlewares"]["use"]>[0][] = [];
  p.configureServer({
    moduleGraph: { getModuleById: () => undefined },
    reloadModule: () => Promise.resolve(),
    ssrLoadModule: () => {
      loads++;
      events.push(`load ${loads}`);
      return Promise.resolve({ apps: [["api", app(loads), () => false]] });
    },
    middlewares: {
      use(fn) {
        used.push(fn);
      },
    },
  });
  const handle = used[1];
  if (handle === undefined) throw new Error("no dev middleware");
  const request = (): Promise<void> =>
    new Promise((resolve) => {
      const req = new http.IncomingMessage(new Socket());
      req.url = "/elsewhere";
      req.method = "GET";
      req.headers = { host: "localhost" };
      handle(req, new http.ServerResponse(req), () => resolve());
    });
  await request();
  p.watchChange(path.join(root, "modules/a/page.ts"), { event: "update" });
  const second = request();
  await ticks();
  expect(loads).toBe(1);
  release();
  await second;
  expect(events).toEqual(["load 1", "close 1", "closed 1", "load 2"]);
});

it("a changed source outside the project loads the whole server graph again; one inside it does not", async () => {
  fs.writeFileSync(path.join(root, "topology.ts"), `export default { api: { modules: ["a"], adapter: "node" } };\n`);
  let loads = 0;
  let all = 0;
  const p = keel();
  p.configResolved({ root });
  const used: Parameters<Parameters<typeof p.configurePreviewServer>[0]["middlewares"]["use"]>[0][] = [];
  p.configureServer({
    moduleGraph: {
      getModuleById: () => undefined,
      invalidateAll: () => {
        all++;
      },
    },
    reloadModule: () => Promise.resolve(),
    ssrLoadModule: () => {
      loads++;
      const app = { fetch: () => Promise.resolve(new Response(null)), close: () => Promise.resolve() };
      return Promise.resolve({ apps: [["api", app, () => false]] });
    },
    middlewares: {
      use(fn) {
        used.push(fn);
      },
    },
  });
  const handle = used[1];
  if (handle === undefined) throw new Error("no dev middleware");
  const request = (): Promise<void> =>
    new Promise((resolve) => {
      const req = new http.IncomingMessage(new Socket());
      req.url = "/elsewhere";
      req.method = "GET";
      req.headers = { host: "localhost" };
      handle(req, new http.ServerResponse(req), () => resolve());
    });
  const outside = path.resolve(root, "..", "linked-package", "src");
  p.watchChange(path.join(outside, "Locale.ts"), { event: "update" });
  expect(all).toBe(0);
  await request();
  expect(loads).toBe(1);
  for (const file of [
    path.join(root, "modules/a/page.ts"),
    path.join(outside, "node_modules/dep/index.js"),
    path.join(outside, "package.json"),
    "\0virtual.ts",
  ])
    p.watchChange(file, { event: "update" });
  expect(all).toBe(0);
  await request();
  expect(loads).toBe(2);
  p.watchChange(`${path.join(outside, "Locale.ts")}?v=1`, { event: "update" });
  expect(all).toBe(1);
  await request();
  expect(loads).toBe(3);
});

it("an edit while the dev apps are still loading makes the next request load them again, after the overtaken ones close", async () => {
  fs.writeFileSync(path.join(root, "topology.ts"), `export default { api: { modules: ["a"], adapter: "node" } };\n`);
  const events: string[] = [];
  let open = (): void => {};
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  let loads = 0;
  const app = (n: number) => ({
    fetch: () => Promise.resolve(new Response(null)),
    close: () => {
      events.push(`close ${n}`);
      return Promise.resolve();
    },
  });
  const p = keel();
  p.configResolved({ root });
  const used: Parameters<Parameters<typeof p.configurePreviewServer>[0]["middlewares"]["use"]>[0][] = [];
  p.configureServer({
    moduleGraph: { getModuleById: () => undefined },
    reloadModule: () => Promise.resolve(),
    ssrLoadModule: async () => {
      loads++;
      const n = loads;
      events.push(`load ${n}`);
      if (n === 1) await gate;
      return { apps: [["api", app(n), () => false]] };
    },
    middlewares: {
      use(fn) {
        used.push(fn);
      },
    },
  });
  const handle = used[1];
  if (handle === undefined) throw new Error("no dev middleware");
  const request = (): Promise<void> =>
    new Promise((resolve) => {
      const req = new http.IncomingMessage(new Socket());
      req.url = "/elsewhere";
      req.method = "GET";
      req.headers = { host: "localhost" };
      handle(req, new http.ServerResponse(req), () => resolve());
    });
  const before = request();
  await ticks();
  expect(loads).toBe(1);
  // The edit lands while load 1 is in flight: it may have read the file before the edit.
  p.watchChange(path.join(root, "modules/a/page.ts"), { event: "update" });
  const after = request();
  await ticks();
  expect(loads).toBe(1);
  open();
  await before;
  await after;
  expect(loads).toBe(2);
  expect(events).toEqual(["load 1", "close 1", "load 2"]);
  await request();
  expect(loads).toBe(2);
});

/** A dev server over `root` whose graph load is `load`; `request()` asks its dev middleware, `all()` counts whole invalidations. */
function devServer(load: (n: number) => Promise<Record<string, unknown>>): {
  p: ReturnType<typeof keel>;
  request(): Promise<unknown>;
  all(): number;
  loads(): number;
} {
  fs.writeFileSync(path.join(root, "topology.ts"), `export default { api: { modules: ["a"], adapter: "node" } };\n`);
  let all = 0;
  let loads = 0;
  const p = keel();
  p.configResolved({ root });
  const used: Parameters<Parameters<typeof p.configurePreviewServer>[0]["middlewares"]["use"]>[0][] = [];
  p.configureServer({
    moduleGraph: {
      getModuleById: () => undefined,
      invalidateAll: () => {
        all++;
      },
    },
    reloadModule: () => Promise.resolve(),
    ssrLoadModule: () => {
      loads++;
      return load(loads);
    },
    middlewares: {
      use(fn) {
        used.push(fn);
      },
    },
  });
  const handle = used[1];
  if (handle === undefined) throw new Error("no dev middleware");
  const request = (): Promise<unknown> =>
    new Promise((resolve) => {
      const req = new http.IncomingMessage(new Socket());
      req.url = "/elsewhere";
      req.method = "GET";
      req.headers = { host: "localhost" };
      handle(req, new http.ServerResponse(req), (e) => resolve(e));
    });
  return { p, request, all: () => all, loads: () => loads };
}
const idle = { fetch: () => Promise.resolve(new Response(null)), close: () => Promise.resolve() };

/** A library `@acme/store` under `root` whose `store` (re-exported by its entry) calls `register`; `modules/a` lists it. */
function storeLibrary(): string {
  const lib = path.join(root, "node_modules/@acme/store");
  fs.mkdirSync(path.join(lib, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "modules/a"), { recursive: true });
  const exports = { ".": { keel: "./src/index.ts", default: "./src/index.ts" } };
  fs.writeFileSync(path.join(lib, "package.json"), JSON.stringify({ name: "@acme/store", keel: "library", exports }));
  fs.writeFileSync(
    path.join(lib, "module.ts"),
    `export default { id: "store", deps: [], capabilities: [], public: { exports: ["store"] } };\n`,
  );
  fs.writeFileSync(path.join(lib, "src/index.ts"), `export { store } from "./store.ts";\n`);
  fs.writeFileSync(
    path.join(lib, "src/store.ts"),
    `import { register } from "@keel/ctx";\nexport const store = (name: string) => register(name, {} as never);\n`,
  );
  const manifest = path.join(root, "modules/a/module.ts");
  fs.writeFileSync(
    manifest,
    `export default { id: "a", deps: ["@acme/store"], capabilities: [], public: { exports: [] } };\n`,
  );
  return manifest;
}

it("an edit to a file importing a registering library export, before it registered, loads the server graph whole", async () => {
  const s = devServer(() => Promise.resolve({ apps: [["api", idle, () => false]] }));
  const manifest = storeLibrary();
  const db = path.join(root, "modules/a/db.server.ts");
  fs.writeFileSync(db, "export const db = 1;\n");
  await s.request();
  s.p.watchChange(manifest, { event: "update" });
  const before = s.all();
  s.p.watchChange(db, { event: "update" });
  expect(s.all()).toBe(before);
  await s.request();
  fs.writeFileSync(db, `import { store } from "@acme/store";\nexport const db = store("a.db");\n`);
  s.p.watchChange(db, { event: "update" });
  expect(s.all()).toBe(before + 1);
  await s.request();
  fs.writeFileSync(db, `import { sql } from "@acme/other";\nexport const db = sql;\n`);
  s.p.watchChange(db, { event: "update" });
  expect(s.all()).toBe(before + 1);
});

it("an edit to a registering file after another edit, before any request, still loads the server graph whole", async () => {
  const s = devServer(() => Promise.resolve({ apps: [["api", idle, () => false]] }));
  fs.mkdirSync(path.join(root, "modules/a"), { recursive: true });
  const db = path.join(root, "modules/a/db.server.ts");
  fs.writeFileSync(db, `import { register } from "@keel/ctx";\nexport const db = register("a.db", {} as never);\n`);
  await s.request();
  s.p.watchChange(path.join(root, "modules/a/page.ts"), { event: "update" });
  expect(s.all()).toBe(0);
  s.p.watchChange(db, { event: "update" });
  expect(s.all()).toBe(1);
  // Nothing was evaluated since: a third edit has no graph to invalidate.
  s.p.watchChange(db, { event: "update" });
  expect(s.all()).toBe(1);
  await s.request();
  expect(s.loads()).toBe(2);
});

it("a load that fails is invalidated whole, and the next request loads again", async () => {
  const s = devServer((n) =>
    n === 1 ? Promise.reject(new Error("first load")) : Promise.resolve({ apps: [["api", idle, () => false]] }),
  );
  expect(String(await s.request())).toContain("first load");
  expect(s.all()).toBeGreaterThan(0);
  expect(await s.request()).toBeUndefined();
  expect(s.loads()).toBe(2);
  await s.request();
  expect(s.loads()).toBe(2);
});

it("a load an edit overtook is invalidated whole once it settles, before the next load", async () => {
  let open = (): void => {};
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const seen: number[] = [];
  const s = devServer(async (n) => {
    seen.push(s.all());
    if (n === 1) await gate;
    return { apps: [["api", idle, () => false]] };
  });
  const before = s.request();
  await ticks();
  s.p.watchChange(path.join(root, "modules/a/page.ts"), { event: "update" });
  expect(s.all()).toBe(0);
  open();
  expect(await before).toBeUndefined();
  expect(seen).toEqual([0, 1]);
});
