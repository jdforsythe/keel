// The plugin's `api.derivedRoutes` (k.derived Refresh, Readers): under `keel dev` the root project's `routes.json` is
// derived once per change by `keel dev`, which hands its entries over; the plugin then evaluates the tokens alone,
// writes no `routes.json`, and its inspect document holds the entries handed over.
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { inspectMiddleware } from "../src/internal/inspectMiddleware.ts";

const calls = vi.hoisted((): { routesFiles: readonly string[] }[] => []);
vi.mock("../src/internal/evaluateProject.ts", async (actual) => {
  const real = await actual<typeof import("../src/internal/evaluateProject.ts")>();
  return {
    evaluateProject: (input: Parameters<typeof real.evaluateProject>[0]) => {
      calls.push({ routesFiles: input.routesFiles });
      return real.evaluateProject(input);
    },
  };
});

type Handler = ReturnType<typeof inspectMiddleware>;
const ENTRY = {
  actions: [],
  guard: null,
  layout: null,
  module: "a",
  path: "/",
  params: {},
  search: {},
};

let root = "";
let server: http.Server | undefined;

beforeEach(() => {
  root = tempDir(".tmp-derived-routes-", import.meta.dirname);
  fs.writeFileSync(path.join(root, "topology.ts"), `export default { web: { modules: ["a"], adapter: "client" } };\n`);
  fs.mkdirSync(path.join(root, "modules", "a"), { recursive: true });
  fs.writeFileSync(path.join(root, "modules", "a", "routes.ts"), "export const routes = {};\n");
  calls.length = 0;
});
afterEach(async () => {
  const s = server;
  if (s !== undefined) await new Promise<void>((resolve) => s.close(() => resolve()));
  server = undefined;
  fs.rmSync(root, { recursive: true, force: true });
});

/** The plugin over `root` with a dev server whose middlewares it registers; its inspect handler. */
function wire(): { p: ReturnType<typeof keel>; inspect: Handler } {
  const p = keel();
  p.configResolved({ root });
  const used: Handler[] = [];
  p.configureServer({
    moduleGraph: { getModuleById: () => undefined },
    reloadModule: () => Promise.resolve(),
    ssrLoadModule: () => Promise.resolve({ apps: [] }),
    middlewares: { use: (fn) => void used.push(fn) },
  });
  const inspect = used[0];
  if (inspect === undefined) throw new Error("no inspect middleware");
  return { p, inspect };
}

/** The inspect document's `routes`, from `mw` listening on a free port. */
async function inspectRoutes(mw: Handler): Promise<unknown> {
  server = http.createServer((req, res) => mw(req, res, () => res.end("next")));
  const s = server;
  await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve));
  const addr: AddressInfo | string | null = s.address();
  const port = typeof addr === "object" && addr !== null ? addr.port : 0;
  const doc: unknown = await (await fetch(`http://127.0.0.1:${port}/__keel/inspect`)).json();
  return typeof doc === "object" && doc !== null ? Reflect.get(doc, "routes") : undefined;
}

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe("api.derivedRoutes", () => {
  it("the inspect document holds the entries handed over, each malformed one left out", async () => {
    const { p, inspect } = wire();
    p.api.derivedRoutes({ "a.home": ENTRY, "a.bad": { path: 1 } });
    expect(await inspectRoutes(inspect)).toEqual({ "a.home": ENTRY });
  });

  it("once routes are handed over, the plugin writes no routes.json; before, it does", async () => {
    // no route table, so the control's evaluation bundles nothing
    fs.rmSync(path.join(root, "modules", "a", "routes.ts"));
    const before = wire();
    await before.p.buildStart.call(undefined);
    expect(fs.existsSync(path.join(root, ".keel", "routes.json"))).toBe(true);
    fs.rmSync(path.join(root, ".keel"), { recursive: true, force: true });
    const after = wire();
    after.p.api.derivedRoutes({ "a.home": ENTRY });
    await after.p.buildStart.call(undefined);
    expect(fs.existsSync(path.join(root, ".keel", "std.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, ".keel", "routes.json"))).toBe(false);
  });

  it("with routes handed over, a route table update evaluates nothing and a new code file evaluates no route table", async () => {
    const { p } = wire();
    p.api.derivedRoutes({});
    p.watchChange(path.join(root, "modules", "a", "routes.ts"), { event: "update" });
    await tick();
    await tick();
    expect(calls).toEqual([]);
    fs.writeFileSync(path.join(root, "modules", "a", "page.ts"), "export const x = 1;\n");
    p.watchChange(path.join(root, "modules", "a", "page.ts"), { event: "create" });
    await tick();
    await tick();
    expect(calls).toEqual([{ routesFiles: [] }]);
  });

  it("handed `undefined`, the plugin evaluates the route tables again", async () => {
    const { p } = wire();
    p.api.derivedRoutes({});
    p.api.derivedRoutes(undefined);
    p.watchChange(path.join(root, "modules", "a", "routes.ts"), { event: "update" });
    await tick();
    await tick();
    expect(calls).toEqual([{ routesFiles: ["modules/a/routes.ts"] }]);
  });
});
