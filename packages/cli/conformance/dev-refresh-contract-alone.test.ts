// Spec: k.cli, clause "While `keel dev` serves the copy of k.derived clause 1 after its edit, changing `app.about`'s path to `/info` in the contract file alone makes, within 2 s, `.keel/routes.json` and `.keel/surface.json` byte-identical to what `keel build` writes, and `GET /__keel/inspect` answer `routes` whose `app.about` has `path` `/info`."
// Seed 1337 (recorded); no random inputs. One `keel dev` on a free port over a copy of `examples/client-only-api` with k.derived clause 1's edit (derived-support.ts `addRoute`) made before it starts; the contract-file edit is made once, in `beforeAll`, and the 2 s are counted on the monotonic clock from the write.
// The dev server is its own process group, killed in `afterAll`. The case "every view that differs" states k.derived Refresh ("`keel dev` does so, `surface.json` and deploy files too"): every present view equals what `keel build` of the same tree writes.
// ASSUMED: the inspect document's `routes` holds an object keyed `app.about` (at any depth) whose `path` is the route's path.
import { type ChildProcess, spawn } from "node:child_process";
import { request } from "node:http";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  BIN,
  type Tree,
  addRoute,
  apiTree,
  build,
  canConnect,
  childEnv,
  cloneTree,
  dropTree,
  freePort,
  nap,
  nowMs,
  read,
  sub,
  until,
  views,
} from "./derived-support.ts";

const SLOW = fixedTime(600_000);
const WITHIN = fixedTime(2_000);
const CONTRACT = "modules/app/app.contract.ts";

const made: Tree[] = [];
let child: ChildProcess | undefined;
/** Milliseconds after the contract edit at which each outcome first held; undefined when it never did within the wait. */
const at: { routes?: number; surface?: number; inspect?: number; views?: number } = {};
let want: Record<string, string> = {};

/** The inspect document's `routes`, read with `node:http`. */
function inspectRoutes(port: number): Promise<unknown> {
  return new Promise((resolve) => {
    const req = request({ host: "127.0.0.1", port, path: "/__keel/inspect", method: "GET" }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c: string) => {
        body += c;
      });
      res.on("end", () => {
        try {
          const doc: unknown = JSON.parse(body);
          resolve(typeof doc === "object" && doc !== null ? Reflect.get(doc, "routes") : undefined);
        } catch {
          resolve(undefined);
        }
      });
    });
    req.on("error", () => resolve(undefined));
    req.end();
  });
}

/** The `path` of the first object keyed `id`, at any depth. */
function pathOf(node: unknown, id: string): unknown {
  if (typeof node !== "object" || node === null) return undefined;
  const direct: unknown = Reflect.get(node, id);
  if (typeof direct === "object" && direct !== null) return Reflect.get(direct, "path");
  for (const v of Object.values(node)) {
    const found = pathOf(v, id);
    if (found !== undefined) return found;
  }
  return undefined;
}

beforeAll(async () => {
  const api = apiTree();
  made.push(api);
  const served = cloneTree(api);
  made.push(served);
  addRoute(served.dir);
  const control = cloneTree(served);
  made.push(control);
  sub(control.dir, CONTRACT, '"app.about": { path: "/about" }', '"app.about": { path: "/info" }');
  build(control.dir);
  want = views(control.dir);

  const port = await freePort();
  child = spawn(process.execPath, [BIN, "dev", "--port", String(port)], {
    cwd: served.dir,
    env: childEnv({}),
    detached: true,
    stdio: "ignore",
  });
  await until(() => canConnect(port), fixedTime(120_000));
  // the dev server has refreshed the tree of the first edit before the second one is made
  await until(async () => pathOf(await inspectRoutes(port), "app.about") === "/about", fixedTime(60_000));

  sub(served.dir, CONTRACT, '"app.about": { path: "/about" }', '"app.about": { path: "/info" }');
  const start = nowMs();
  while (nowMs() - start < WITHIN) {
    const now = Math.round(nowMs() - start);
    const have = views(served.dir);
    if (at.routes === undefined && have[".keel/routes.json"] === want[".keel/routes.json"]) at.routes = now;
    if (at.surface === undefined && have[".keel/surface.json"] === want[".keel/surface.json"]) at.surface = now;
    if (at.views === undefined && JSON.stringify(have) === JSON.stringify(want)) at.views = now;
    if (at.inspect === undefined && pathOf(await inspectRoutes(port), "app.about") === "/info") at.inspect = now;
    if (at.routes !== undefined && at.surface !== undefined && at.views !== undefined && at.inspect !== undefined)
      break;
    nap(25);
  }
  expect(read(served.dir, CONTRACT)).toContain('"/info"');
}, SLOW);

afterAll(() => {
  if (child !== undefined && child.exitCode === null && child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
  for (const t of made) dropTree(t);
});

describe("k.cli: `keel dev` refreshes on a contract file alone", () => {
  test("changing `app.about`'s path to `/info` in the contract file alone makes, within 2 s, `.keel/routes.json` byte-identical to what `keel build` writes", () => {
    expect(at.routes, "ms until routes.json matched").toBeLessThanOrEqual(2_000);
  });

  test("changing `app.about`'s path to `/info` in the contract file alone makes, within 2 s, `.keel/surface.json` byte-identical to what `keel build` writes", () => {
    expect(at.surface, "ms until surface.json matched").toBeLessThanOrEqual(2_000);
  });

  test("changing `app.about`'s path to `/info` in the contract file alone makes `GET /__keel/inspect` answer `routes` whose `app.about` has `path` `/info`, within 2 s", () => {
    expect(at.inspect, "ms until the inspect document held /info").toBeLessThanOrEqual(2_000);
  });

  test("every present view is byte-identical to what `keel build` of that tree writes after the refresh", () => {
    expect(at.views, "ms until every view matched").toBeLessThanOrEqual(2_000);
  });
});
