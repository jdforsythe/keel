// k.boundary, Limits "A value in a file that is not server-only ships when a browser file imports it: a secret hard-coded in a schema, a `routes.ts` or a shared helper is public. A `routes.ts` a page imports runs in the browser; only its server-only imports are stubbed. Bundles, names and config: k.bundle."
// Seed 1337 (no random input: two fixtures, built once each). The real binary over the node fixture of boundary-support.ts with two changes: a value hard-coded in a shared schema file and top-level code in `routes.ts`; a second fixture adds a `define` in the project's `vite.config.ts`.
// What the boundary does not promise is stated as behavior: the first two values are in the browser asset. The config case is k.bundle's: a project `define` fails the build with E1007 `environment config` and nothing is written.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SLOW, built, cleanup, filesHolding, materialize, nodeTree, withFiles } from "./boundary-support.ts";

const HARD = "K_HARD_f13a9c07e5b2486d1a30";
const TOPLEVEL = "K_ROUTES_8e41d6b0a9c3725f4e1d";
const DEFINE = "K_DEFINE_2b7f0c9e4a1d8365c0f9";

const base = nodeTree("node");
const tree = () =>
  withFiles(base, {
    "modules/a/Params.schema.ts": `import { s } from '@keel/schema'\nexport const Params = s.object({ id: s.enum(['x', '${HARD}']) })\n`,
    "modules/a/routes.ts": `${base["modules/a/routes.ts"] ?? ""}Reflect.set(globalThis, 'routesTop', '${TOPLEVEL}')\n`,
    "modules/a/Page.tsx": `import './routes.ts'\n${base["modules/a/Page.tsx"] ?? ""}`,
  });
const withDefine = () =>
  withFiles(base, {
    "vite.config.ts": `import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()], define: { __FROM_CONFIG__: JSON.stringify('${DEFINE}') } });\n`,
    "modules/a/Page.tsx": `${base["modules/a/Page.tsx"] ?? ""}declare const __FROM_CONFIG__: string\nReflect.set(globalThis, 'fromConfig', __FROM_CONFIG__)\n`,
  });

let dir = "";
let result: ReturnType<typeof built>;
let defDir = "";
let defResult: ReturnType<typeof built>;
beforeAll(() => {
  dir = materialize(tree());
  result = built(dir);
  defDir = materialize(withDefine());
  defResult = built(defDir);
}, SLOW);
afterAll(() => {
  cleanup(dir);
  cleanup(defDir);
});

describe("k.boundary Limits: what is not server-only ships when a browser file imports it", () => {
  test("a value hard-coded in a shared schema file a page imports is in a browser asset", () => {
    expect(result.status, result.out).toBe(0);
    expect(filesHolding(join(dir, "dist", "api", "assets"), HARD)).not.toEqual([]);
  });

  test("a `routes.ts` a page imports runs in the browser: its own top-level code is in a browser asset", () => {
    expect(result.status, result.out).toBe(0);
    expect(filesHolding(join(dir, "dist", "api", "assets"), TOPLEVEL)).not.toEqual([]);
  });

  test("a `define` in the project's `vite.config.ts` fails the build with E1007 `environment config` and writes nothing for `api`", () => {
    expect(defResult.status, defResult.out).toBe(1);
    const hits = defResult.out.split("\n").filter((l) => l.includes("E1007"));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.join("\n")).toContain("environment config");
    expect(filesHolding(join(defDir, "dist"), DEFINE)).toEqual([]);
    expect(existsSync(join(defDir, "dist", "api"))).toBe(false);
  });
});
