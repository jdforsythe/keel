// surfaceRun (k.compat Surface): `keel build`'s `.keel/surface.json`, written read-only as `{ data, hash }`, from the
// contracts and route tables a Vite SSR evaluation of the project reads; E1006 for a contract or route file that throws. Each
// case evaluates a project in a temp directory under the package's test directory. Seed 1337.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceHash } from "@keel/compiler/internal";
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { hashOf } from "../src/internal/hashOf.ts";
import { surfaceRun } from "../src/internal/surfaceRun.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const project = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(here, ".tmp-surfaceRun-"));
  dirs.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
};
const SLOW = fixedTime(120_000);
const contractTs = (path: string): string =>
  `import { contract } from "@keel/router/contract";\nimport { s } from "@keel/schema";\nexport const m = contract("m", {\n  "m.home": { path: "/home" },\n  "m.feed": { method: "GET", path: ${JSON.stringify(path)}, output: s.json() },\n});\n`;
const ROUTES = `import { loader, manifest } from "@keel/router";
import { ok } from "@keel/schema";
import { m } from "./m.contract.ts";
export const routes = manifest(m, {
  "m.home": { component: () => null },
  "m.feed": { loader: loader(m, "m.feed", {}, async () => ok(null)) },
});
`;
const CALLER = `import { service } from "@keel/services";
import { m } from "../m/m.contract.ts";
export const api = service({ contract: m });
`;
const surfaceOn = (dir: string): { data: Record<string, unknown>; hash: unknown; text: string } => {
  const text = readFileSync(join(dir, ".keel", "surface.json"), "utf8");
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null) throw new Error("surface.json is not an object");
  const data: unknown = Reflect.get(parsed, "data");
  if (typeof data !== "object" || data === null) throw new Error("no data");
  return { data: Object.fromEntries(Object.entries(data)), hash: Reflect.get(parsed, "hash"), text };
};

describe("surfaceRun", () => {
  test(
    "surfaceRun on a project with no contract and no routes writes an empty surface",
    async () => {
      const dir = project({ "readme.md": "x\n" });
      expect(await surfaceRun(dir)).toEqual({ code: 0, notes: [] });
      const s = surfaceOn(dir);
      expect(s.data).toEqual({ version: 2, contracts: {}, stores: {}, sources: {} });
      expect(s.hash).toBe(hashOf(s.data));
      expect(s.text.endsWith("}\n")).toBe(true);
      expect(statSync(join(dir, ".keel", "surface.json")).mode & 0o222).toBe(0);
    },
    SLOW,
  );

  test(
    "each API entry of modules/<m>/<m>.contract.ts is recorded under its module, with the hash of each evaluated file",
    async () => {
      const source = contractTs("/api/feed");
      const dir = project({ "modules/m/m.contract.ts": source, "modules/m/routes.ts": ROUTES });
      expect(await surfaceRun(dir)).toEqual({ code: 0, notes: [] });
      const s = surfaceOn(dir);
      expect(s.data.version).toBe(2);
      expect(s.data.contracts).toEqual({
        m: {
          module: "m",
          callers: [],
          entries: {
            "m.feed": {
              method: "GET",
              path: "/api/feed",
              params: null,
              query: null,
              body: null,
              output: {},
              errors: {},
            },
          },
        },
      });
      expect(s.data.sources).toEqual({
        "modules/m/m.contract.ts": sourceHash("modules/m/m.contract.ts", source),
        "modules/m/routes.ts": sourceHash("modules/m/routes.ts", ROUTES),
      });
      expect(s.hash).toBe(hashOf(s.data));
    },
    SLOW,
  );

  test(
    "a module importing the contract is one of its callers; a contract with no API entry has no key",
    async () => {
      const dir = project({
        "modules/m/m.contract.ts": contractTs("/api/feed"),
        "modules/a/api.ts": CALLER,
        "modules/p/p.contract.ts": `import { contract } from "@keel/router/contract";\nexport const p = contract("p", { "p.home": { path: "/p" } });\n`,
      });
      expect(await surfaceRun(dir)).toEqual({ code: 0, notes: [] });
      expect(surfaceOn(dir).data.contracts).toMatchObject({ m: { callers: ["a"] } });
      expect(Object.keys(Object(surfaceOn(dir).data.contracts))).toEqual(["m"]);
    },
    SLOW,
  );

  test(
    "a contract file that throws is E1006 naming the file and the first 60 characters of the first line; code 1, nothing written",
    async () => {
      const long = "y".repeat(100);
      const dir = project({
        "modules/m/m.contract.ts": `throw new Error(${JSON.stringify(`${long}\nsecond line`)});\n`,
        "modules/m/routes.ts": ROUTES,
      });
      const r = await surfaceRun(dir);
      expect(r).toEqual({ code: 1, notes: [`E1006 modules/m/m.contract.ts failed to evaluate: ${"y".repeat(60)}\n`] });
      expect(existsSync(join(dir, ".keel", "surface.json"))).toBe(false);
    },
    SLOW,
  );

  test(
    "a contract file with a syntax error is an E1006 note carrying the E1000 location",
    async () => {
      const dir = project({ "modules/m/m.contract.ts": "export const m = contract({ \n" });
      const r = await surfaceRun(dir);
      expect(r.code).toBe(1);
      expect(r.notes).toHaveLength(1);
      expect(r.notes[0]?.startsWith("E1006 modules/m/m.contract.ts failed to evaluate: E1000 ")).toBe(true);
    },
    SLOW,
  );

  test(
    "a routes.ts that throws is E1006 naming the file and the first 60 characters of the first line; code 1, nothing written",
    async () => {
      const dir = project({
        "modules/m/m.contract.ts": contractTs("/api/feed"),
        "modules/m/routes.ts": `throw new Error(${JSON.stringify(`${"z".repeat(80)}\nsecond line`)});\n`,
      });
      expect(await surfaceRun(dir)).toEqual({
        code: 1,
        notes: [`E1006 modules/m/routes.ts failed to evaluate: ${"z".repeat(60)}\n`],
      });
      expect(existsSync(join(dir, ".keel", "surface.json"))).toBe(false);
    },
    SLOW,
  );

  test(
    "a routes.ts throwing a value with an E code keeps its code and message; code 1",
    async () => {
      const dir = project({
        "modules/m/m.contract.ts": contractTs("/api/feed"),
        "modules/m/routes.ts": 'throw Object.assign(new Error("guard m.home has no route"), { code: "E1502" });\n',
      });
      expect(await surfaceRun(dir)).toEqual({ code: 1, notes: ["E1502 guard m.home has no route\n"] });
    },
    SLOW,
  );

  test(
    "a placed stdlib module whose ./routes throws is E1006 naming its real file; code 1",
    async () => {
      const dir = project({
        "topology.ts": 'export default topology({ web: { modules: ["app", "boom"], adapter: "node" } });\n',
        "modules/app/module.ts":
          'import { module } from "@keel/compiler";\nexport default module({ id: "app", deps: ["@keel/std-boom"], capabilities: [], public: { exports: [] } });\n',
        "node_modules/@keel/std-boom/package.json": `${JSON.stringify({
          name: "@keel/std-boom",
          type: "module",
          exports: { "./module": "./module.ts", "./routes": "./routes.ts" },
        })}\n`,
        "node_modules/@keel/std-boom/module.ts":
          'import { module } from "@keel/compiler";\nexport default module({ id: "boom", deps: [], capabilities: [], public: { exports: [] } });\n',
        "node_modules/@keel/std-boom/routes.ts": 'throw new Error("boom routes");\n',
      });
      const run = await surfaceRun(dir);
      expect(run.code).toBe(1);
      expect(run.notes).toHaveLength(1);
      expect(run.notes[0]).toMatch(
        /^E1006 \S*node_modules\/@keel\/std-boom\/routes\.ts failed to evaluate: boom routes\n$/,
      );
    },
    SLOW,
  );

  test(
    "property: the recorded path of an API entry is the path its contract declares",
    async () => {
      const seg = fc.stringMatching(/^[a-z]{1,6}$/);
      await fc.assert(
        fc.asyncProperty(fc.array(seg, { minLength: 1, maxLength: 3 }), async (segs) => {
          const path = `/api/${segs.join("/")}`;
          const dir = project({ "modules/m/m.contract.ts": contractTs(path) });
          expect(await surfaceRun(dir)).toEqual({ code: 0, notes: [] });
          expect(surfaceOn(dir).data.contracts).toMatchObject({ m: { entries: { "m.feed": { path } } } });
        }),
        { seed: 1337, numRuns: 4 },
      );
    },
    SLOW * 2,
  );
  test(
    "a layout's loader and its page's naming two factories that create one store id are an E1550 note and code 1",
    async () => {
      const server = (page: string): string => `import { loader } from "@keel/router";
import { ok, s } from "@keel/schema";
import { store } from "@keel/store";
import { m } from "./m.contract.ts";
const S = s.object({});
export const frameStores = () => ({ s: store(S, {}, { id: "m.s" }) });
export const pageStores = () => ({ ...frameStores(), t: store(S, {}, { id: "m.t" }) });
export const unread = () => ({ s: store(S, {}, { id: \`m.\${"s"}\` }) });
export const L = loader(m, "m.frame", { output: S, stores: frameStores }, async () => ok({}));
export const P = loader(m, "m.home", { output: S, stores: ${page} }, async () => ok({}));
`;
      const files = (page: string): Record<string, string> => ({
        "modules/m/m.contract.ts": `import { contract } from "@keel/router/contract";\nexport const m = contract("m", { "m.frame": { layout: true }, "m.home": { path: "/home" } });\n`,
        "modules/m/m.server.ts": server(page),
        "modules/m/routes.ts": `import { manifest } from "@keel/router";\nimport { m } from "./m.contract.ts";\nimport { L, P } from "./m.server.ts";\nexport const routes = manifest(m, { "m.frame": { component: () => null, loader: L }, "m.home": { component: () => null, layout: "m.frame", loader: P } });\n`,
      });
      expect(await surfaceRun(project(files("unread")))).toEqual({
        code: 1,
        notes: [
          "E1550 route m.home: stores: unread and frameStores (m.frame) both create store m.s; name one factory\n",
        ],
      });
      expect(await surfaceRun(project(files("frameStores")))).toEqual({ code: 0, notes: [] });
    },
    SLOW,
  );
});
