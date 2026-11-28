// Spec: k.deploy, clause "`node server.mjs` of a `keel build` fixture, in production mode, with `KEEL_LOG_THROWN=yes` writes one `diag` whose code is E1596 and whose message names `KEEL_LOG_THROWN` and holds no `yes`; with `KEEL_ORIGIN=not-an-origin` one whose code is E1560 naming `KEEL_ORIGIN` and holding no `not-an-origin`; and a start given a topology whose served deployable lists a module no route belongs to (a module with a manifest and no routes, which `keel build` accepts), one whose code is E1552 and whose message names the deployable and the module. Each exits 1, listens on no port, and writes no line holding `E1577` or `#`."
// Spec: k.deploy, clause "A start that fails with `new Error('db password hunter2')` thrown at module scope by a plain npm package the app imports writes one E1577 record matching `^uncaught exception in work of route -: Error #[0-9a-f]{8}( at \S+:\d+)?$` and no line holding `hunter2`."
// k.deploy, Refusals at start "a port that will not bind is E1560 naming `PORT`, never its number (with `PORT` unset, Keel's default 8080)."; Rules "E1560 `DeployEnv` fails (a `KEEL_ORIGIN` that is no http(s) origin too), a port will not bind, ...". The case binds a port the OS just gave this process and starts on it; `PORT` unset is not run (8080 is not used on this machine).
// Seed 1337 (no generated input: the bad values are fixed). The real binary builds one `node` fixture; `dist/api/server.mjs` is then spawned once per case in json format, and every child is killed in `afterEach`.
// The package throws only when `FIXTURE_BOOM` is `1`, so `keel build` (which evaluates the routes) succeeds and the start fails.
// Reading: the spec names the module as one with a manifest and no routes, listed by the deployable; `keel build` of it succeeds, and the start refuses it. The case needs no hand-edited bundle.
import { type ChildProcess, spawn } from "node:child_process";
import net from "node:net";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { SLOW, type Tree, childEnv, cleanup, keelRun, manifestSrc, materialize, nodeTree } from "./boundary-support.ts";

const children: ChildProcess[] = [];
const dirs: string[] = [];
const holders: net.Server[] = [];
afterEach(() => {
  for (const c of children.splice(0)) c.kill("SIGKILL");
  for (const h of holders.splice(0)) h.close();
});
/** A port this process holds open, so a start on it will not bind. */
const heldPort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    holders.push(srv);
    srv.listen(0, () => {
      const addr = srv.address();
      if (typeof addr === "object" && addr !== null) resolve(addr.port);
      else reject(new Error("no port"));
    });
  });
afterAll(() => {
  for (const d of dirs.splice(0)) cleanup(d);
});

const built = (tree: Tree): string => {
  const dir = materialize(tree);
  dirs.push(dir);
  const r = keelRun(dir, ["build"]);
  expect(r.status, r.out).toBe(0);
  return dir;
};

type Ran = { code: number | null; text: string; records: Record<string, unknown>[] };
/** Runs `node dist/api/server.mjs` with `env` until it exits; `text` is every line it wrote. */
async function start(dir: string, env: Record<string, string>): Promise<Ran> {
  const child = spawn(process.execPath, [join(dir, "dist", "api", "server.mjs")], {
    cwd: dir,
    env: childEnv({ PORT: "0", KEEL_SECRET: "s".repeat(32), KEEL_FORMAT: "json", ...env }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  let text = "";
  child.stdout?.on("data", (d: Buffer) => void (text += d.toString()));
  child.stderr?.on("data", (d: Buffer) => void (text += d.toString()));
  const code = await new Promise<number | null>((resolve) => child.on("close", (c) => resolve(c)));
  const records = text
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l): unknown => JSON.parse(l))
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .filter((r) => r.kind === "diag");
  return { code, text, records };
}

let app = "";
let ghost = "";
let thrower = "";
beforeAll(() => {
  app = built(nodeTree("node"));
  ghost = built({
    ...nodeTree("node"),
    "modules/b/module.ts": manifestSrc("b"),
    "topology.ts":
      "import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['a', 'b'], adapter: 'node' } })\n",
  });
  const base = nodeTree("node");
  thrower = built({
    ...base,
    "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { dbpkg: "1.0.0" } })}\n`,
    "node_modules/dbpkg/package.json": `${JSON.stringify({ name: "dbpkg", version: "1.0.0", type: "module", main: "index.js" })}\n`,
    "node_modules/dbpkg/index.js": "if (process.env.FIXTURE_BOOM === '1') throw new Error('db password hunter2')\n",
    "modules/a/load.server.ts": `import 'dbpkg'\n${base["modules/a/load.server.ts"] ?? ""}`,
  });
}, SLOW);

const NO_E1577 = (r: Ran): void => {
  expect(r.text).not.toContain("E1577");
  expect(r.text).not.toContain("#");
  expect(r.code).toBe(1);
};

describe("k.deploy Refusals at start: a coded refusal prints its own code", () => {
  test(
    "`KEEL_LOG_THROWN=yes` writes one `diag` whose code is E1596 and whose message names `KEEL_LOG_THROWN` and holds no `yes`, exits 1, listens on no port, writes no line holding `E1577` or `#`",
    async () => {
      const r = await start(app, { KEEL_LOG_THROWN: "yes" });
      expect(r.records, r.text).toHaveLength(1);
      expect(r.records[0]?.code).toBe("E1596");
      expect(String(r.records[0]?.message)).toContain("KEEL_LOG_THROWN");
      expect(String(r.records[0]?.message)).not.toContain("yes");
      NO_E1577(r);
    },
    SLOW,
  );

  test(
    "`KEEL_ORIGIN=not-an-origin` writes one `diag` whose code is E1560 naming `KEEL_ORIGIN` and holding no `not-an-origin`, exits 1, writes no line holding `E1577` or `#`",
    async () => {
      const r = await start(app, { KEEL_ORIGIN: "not-an-origin" });
      expect(r.records, r.text).toHaveLength(1);
      expect(r.records[0]?.code).toBe("E1560");
      expect(String(r.records[0]?.message)).toContain("KEEL_ORIGIN");
      expect(r.text).not.toContain("not-an-origin");
      NO_E1577(r);
    },
    SLOW,
  );

  test(
    "a port that will not bind writes one `diag` whose code is E1560 naming `PORT` and not its number, exits 1, writes no line holding `E1577` or `#`",
    async () => {
      const port = await heldPort();
      const r = await start(app, { PORT: String(port) });
      expect(r.records, r.text).toHaveLength(1);
      expect(r.records[0]?.code).toBe("E1560");
      const m = String(r.records[0]?.message);
      expect(m).toContain("PORT");
      expect(m).not.toContain(String(port));
      NO_E1577(r);
    },
    SLOW,
  );

  test(
    "a start given a topology whose served deployable lists a module no route belongs to writes one `diag` whose code is E1552 and whose message names the deployable and the module, exits 1, writes no line holding `E1577` or `#`",
    async () => {
      const r = await start(ghost, {});
      expect(r.records, r.text).toHaveLength(1);
      expect(r.records[0]?.code).toBe("E1552");
      const m = String(r.records[0]?.message);
      expect(m).toContain("api");
      expect(m).toContain("b");
      NO_E1577(r);
    },
    SLOW,
  );

  test(
    "a refusal prints its own `see` line",
    async () => {
      const r = await start(app, { KEEL_LOG_THROWN: "yes" });
      expect(JSON.stringify(r.records[0])).toContain("see");
    },
    SLOW,
  );
});

describe("k.deploy Refusals at start: E1577 keeps one meaning", () => {
  test(
    "a start that fails with `new Error('db password hunter2')` thrown at module scope by a plain npm package the app imports writes one E1577 record matching `^uncaught exception in work of route -: Error #[0-9a-f]{8}( at \\S+:\\d+)?$` and no line holding `hunter2`",
    async () => {
      const r = await start(thrower, { FIXTURE_BOOM: "1" });
      const e1577 = r.records.filter((x) => x.code === "E1577");
      expect(e1577, r.text).toHaveLength(1);
      expect(String(e1577[0]?.message)).toMatch(
        /^uncaught exception in work of route -: Error #[0-9a-f]{8}( at \S+:\d+)?$/,
      );
      expect(r.text).not.toContain("hunter2");
    },
    SLOW,
  );
});
