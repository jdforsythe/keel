// surfaceRun (k.compat Surface): `keel build`'s `.keel/surface.json`, written read-only as `{ data, hash }`, from the
// routes and `service({ module })` calls a Vite SSR evaluation of the project reads; E1006 for an endpoints file that
// throws. Each case evaluates a project in a temp directory under the package's test directory. Seed 1337.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
const SLOW = 120_000;
const routesTs = (path: string): string =>
  `import { manifest } from "@keel/router";\nexport const routes = manifest({ "m.home": { path: ${JSON.stringify(path)}, component: () => null } });\n`;
const CALLER = `import { s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
export const schema = endpoints({ get: { method: "GET", path: "/home", output: s.json() } });
export const api = service({ module: "m", schema });
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
    "surfaceRun on a project with no routes and no service calls writes an empty surface",
    async () => {
      const dir = project({ "readme.md": "x\n" });
      expect(await surfaceRun(dir)).toEqual({ code: 0, notes: [] });
      const s = surfaceOn(dir);
      expect(s.data).toEqual({ version: 1, routes: {}, services: [], stores: {}, sources: {} });
      expect(s.hash).toBe(hashOf(s.data));
      expect(s.text.endsWith("}\n")).toBe(true);
      expect(statSync(join(dir, ".keel", "surface.json")).mode & 0o222).toBe(0);
    },
    SLOW,
  );

  test(
    "each modules/<m>/routes.ts route is recorded with its module, path and file, and its source hash",
    async () => {
      const source = routesTs("/home");
      const dir = project({ "modules/m/routes.ts": source });
      expect(await surfaceRun(dir)).toEqual({ code: 0, notes: [] });
      const s = surfaceOn(dir);
      expect(s.data.version).toBe(1);
      expect(s.data.routes).toMatchObject({
        "m.home": { module: "m", path: "/home", file: "modules/m/routes.ts", get: null, actions: {} },
      });
      expect(s.data.sources).toEqual({ "modules/m/routes.ts": hashOf(source) });
      expect(s.hash).toBe(hashOf(s.data));
    },
    SLOW,
  );

  test(
    "a service({ module }) call in an app file is recorded with its caller, module and endpoints; the file is hashed",
    async () => {
      const dir = project({ "modules/m/routes.ts": routesTs("/home"), "modules/a/api.ts": CALLER });
      expect(await surfaceRun(dir)).toEqual({ code: 0, notes: [] });
      const s = surfaceOn(dir);
      expect(s.data.services).toMatchObject([
        {
          file: "modules/a/api.ts",
          caller: "a",
          module: "m",
          endpoints: { get: { method: "GET", path: "/home", params: null, query: null, body: null, errors: {} } },
        },
      ]);
      expect(s.data.sources).toEqual({
        "modules/m/routes.ts": hashOf(routesTs("/home")),
        "modules/a/api.ts": hashOf(CALLER),
      });
    },
    SLOW,
  );

  test(
    "an endpoints file that throws is E1006 naming the file and the first 60 characters of the first line; code 1, nothing written",
    async () => {
      const long = "y".repeat(100);
      const dir = project({
        "modules/m/routes.ts": routesTs("/home"),
        "modules/a/api.ts": `import { service } from "@keel/services";\nthrow new Error(${JSON.stringify(`${long}\nsecond line`)});\nexport const api = service({ module: "m", schema: {} });\n`,
      });
      const r = await surfaceRun(dir);
      expect(r).toEqual({ code: 1, notes: [`E1006 modules/a/api.ts failed to evaluate: ${"y".repeat(60)}\n`] });
      expect(existsSync(join(dir, ".keel", "surface.json"))).toBe(false);
    },
    SLOW,
  );

  test(
    "a caller with a syntax error is an E1006 note carrying the E1000 location; a routes.ts with one records no route",
    async () => {
      const dir = project({
        "modules/m/routes.ts": "export const routes = manifest({ \n",
        "modules/a/api.ts": `import { service } from "@keel/services";\nexport const api = service({ module: "m", schema: {} ;\n`,
      });
      const r = await surfaceRun(dir);
      expect(r.code).toBe(1);
      expect(r.notes).toHaveLength(1);
      expect(r.notes[0]?.startsWith("E1006 modules/a/api.ts failed to evaluate: ")).toBe(true);
      const routesOnly = project({ "modules/m/routes.ts": "export const routes = manifest({ \n" });
      expect(await surfaceRun(routesOnly)).toEqual({ code: 0, notes: [] });
      expect(surfaceOn(routesOnly).data.routes).toEqual({});
    },
    SLOW,
  );

  test(
    "a file that mentions @keel/services without a module key is not evaluated as a caller",
    async () => {
      const dir = project({
        "modules/a/api.ts": `import { service } from "@keel/services";\nthrow new Error("not evaluated");\nexport const api = service({ base: "https://x.test" });\n`,
      });
      expect(await surfaceRun(dir)).toEqual({ code: 0, notes: [] });
      expect(surfaceOn(dir).data.sources).toEqual({});
    },
    SLOW,
  );

  test(
    "a routes.ts that throws does not fail the build: the surface is written without its routes",
    async () => {
      const dir = project({ "modules/m/routes.ts": 'throw new Error("no routes");\n' });
      expect(await surfaceRun(dir)).toEqual({ code: 0, notes: [] });
      expect(surfaceOn(dir).data.routes).toEqual({});
    },
    SLOW,
  );

  test(
    "property: the recorded path of a route is the path its routes.ts declares",
    async () => {
      const seg = fc.stringMatching(/^[a-z]{1,6}$/);
      await fc.assert(
        fc.asyncProperty(fc.array(seg, { minLength: 1, maxLength: 3 }), async (segs) => {
          const path = `/${segs.join("/")}`;
          const dir = project({ "modules/m/routes.ts": routesTs(path) });
          expect(await surfaceRun(dir)).toEqual({ code: 0, notes: [] });
          expect(surfaceOn(dir).data.routes).toMatchObject({ "m.home": { path } });
        }),
        { seed: 1337, numRuns: 4 },
      );
    },
    SLOW * 2,
  );
});
