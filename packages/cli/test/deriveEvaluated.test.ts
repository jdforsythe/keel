// deriveEvaluated (k.derived Derivations, Derivation cache; k.compat Surface): one evaluation of a project's contracts
// and route tables gives `routes.json` and `surface.json` (version 3, no `sources`), its problems as Keel-coded lines,
// and, with `node_modules`, a cache entry that a later run reads while every input it loaded is unchanged. Each case
// evaluates a project in a temp directory under this test directory. Seed 1337 (no generated input).
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, test } from "vitest";
import type { Work } from "../src/internal/derived/Work.ts";
import { deriveEvaluated } from "../src/internal/derived/deriveEvaluated.ts";
import { hashOf } from "../src/internal/hashOf.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const SLOW = fixedTime(120_000);
const project = (files: Record<string, string>): string => {
  const dir = tempDir(".tmp-deriveEvaluated-", here);
  dirs.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
};
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
const files = (dir: string, paths: readonly string[]) =>
  paths.map((p) => ({ path: p, source: readFileSync(join(dir, p), "utf8") }));
const run = async (dir: string, paths: readonly string[]) => {
  const work: Work = { evaluated: 0, cached: 0, refreshed: 0 };
  const r = await deriveEvaluated(dir, files(dir, paths), paths, work);
  const parsed: unknown = JSON.parse(r.surface);
  const data: unknown = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "data") : undefined;
  return { ...r, work, data, hash: typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "hash") : "" };
};

describe("deriveEvaluated", () => {
  test(
    "a project with no route table, contract or topology.ts evaluates nothing: an empty surface of version 3",
    async () => {
      const dir = project({ "modules/m/a.ts": "export const a = 1\n" });
      const r = await run(dir, ["modules/m/a.ts"]);
      expect(r.data).toEqual({ version: 3, contracts: {}, stores: {} });
      expect(r.hash).toBe(hashOf(r.data));
      expect(r.work).toEqual({ evaluated: 0, cached: 0, refreshed: 0 });
    },
    SLOW,
  );

  test(
    "each API entry of modules/<m>/<m>.contract.ts is recorded under its module with its callers, and no sources",
    async () => {
      const dir = project({
        "modules/m/m.contract.ts": contractTs("/api/feed"),
        "modules/m/routes.ts": ROUTES,
        "modules/a/api.ts": CALLER,
      });
      const r = await run(dir, ["modules/a/api.ts", "modules/m/m.contract.ts", "modules/m/routes.ts"]);
      expect(r.problems).toEqual([]);
      expect(r.data).toEqual({
        version: 3,
        stores: {},
        contracts: {
          m: {
            module: "m",
            callers: ["a"],
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
        },
      });
      expect(r.work.evaluated).toBe(1);
      expect(JSON.parse(r.routes)).toMatchObject({ data: { "m.home": { path: "/home" } } });
    },
    SLOW,
  );

  test(
    "a contract file that throws is one E1006 line naming the file",
    async () => {
      const dir = project({
        "modules/m/m.contract.ts": `throw new Error(${JSON.stringify(`${"y".repeat(100)}\nsecond line`)});\n`,
        "modules/m/routes.ts": ROUTES,
      });
      const r = await run(dir, ["modules/m/m.contract.ts", "modules/m/routes.ts"]);
      expect(r.problems).toHaveLength(1);
      expect(r.problems[0]?.startsWith("E1006 modules/m/m.contract.ts failed to evaluate: yyy")).toBe(true);
    },
    SLOW,
  );

  test(
    "a routes.ts throwing a value with an E code keeps its code and message",
    async () => {
      const dir = project({
        "modules/m/m.contract.ts": contractTs("/api/feed"),
        "modules/m/routes.ts": 'throw Object.assign(new Error("guard m.home has no route"), { code: "E1502" });\n',
      });
      const r = await run(dir, ["modules/m/m.contract.ts", "modules/m/routes.ts"]);
      expect(r.problems).toEqual(["E1502 guard m.home has no route"]);
    },
    SLOW,
  );

  test(
    "with node_modules, a second run reads the cache; an edit to a loaded file evaluates again, its new entry beside",
    async () => {
      const dir = project({
        "modules/m/m.contract.ts": contractTs("/api/feed"),
        "modules/m/routes.ts": ROUTES,
        "node_modules/.keep": "",
      });
      const paths = ["modules/m/m.contract.ts", "modules/m/routes.ts"];
      const first = await run(dir, paths);
      expect(first.work).toEqual({ evaluated: 1, cached: 0, refreshed: 0 });
      const second = await run(dir, paths);
      expect(second.work).toEqual({ evaluated: 0, cached: 1, refreshed: 0 });
      expect(second.surface).toBe(first.surface);
      expect(second.routes).toBe(first.routes);
      writeFileSync(join(dir, "modules/m/m.contract.ts"), contractTs("/api/feed2"));
      const third = await run(dir, paths);
      expect(third.work).toEqual({ evaluated: 1, cached: 0, refreshed: 0 });
      expect(third.surface).toContain("/api/feed2");
      const entries = readdirSync(join(dir, "node_modules/.cache/keel/derived"));
      expect(entries.filter((n) => n.endsWith(".json"))).toHaveLength(2);
      expect(entries.filter((n) => n.endsWith(".tmp"))).toEqual([]);
    },
    SLOW,
  );

  test(
    "held() is false once a loaded file changes after the derivation",
    async () => {
      const dir = project({ "modules/m/m.contract.ts": contractTs("/api/feed"), "modules/m/routes.ts": ROUTES });
      const r = await run(dir, ["modules/m/m.contract.ts", "modules/m/routes.ts"]);
      expect(r.held()).toBe(true);
      writeFileSync(join(dir, "modules/m/routes.ts"), `${ROUTES}// edited\n`);
      expect(r.held()).toBe(false);
    },
    SLOW,
  );
});
