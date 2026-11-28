// Spec: k.data, clause "Under `keel dev`, with `modules/a/x.ts` holding a module-level store of id `a.s` and `modules/a/y.ts` left without one, both imported by `modules/a/routes.ts`, editing `y.ts` to add a module-level store of id `a.s` makes the dev output hold `already in use` on the next request."
// Spec: k.data, clause "Under `keel dev`, in that app before the edit to `y.ts`, editing `x.ts` to rename its store's id from `a.s` to `a.t` and, after the next request, editing `y.ts` to add a module-level store of id `a.s` leaves the dev output without `already in use` on the request after that; a second edit of `y.ts` adding one more of id `a.t` makes it hold `store a.t: id already in use by a live store`."
// Seed 1337 (recorded); no random inputs. One `keel dev` per case (evaluator-support.ts `startDev`) on a free port over a temp project with the kernel packages and `vite` linked, as data-dev-reload.test.ts builds it; stopped (its process group, which this file spawned) at each case's end and in `afterAll`.
// "The next request" is the first `GET /api/a/one` whose answer carries the edited files' `version` tags (each file exports one, the loader joins them), so a request the old graph answered is not counted; when the edit makes the load fail, the dev output is polled while requests go on, bounded on the monotonic clock.
// ASSUMED: each store's export name is the last segment of its id (`<module>.<export>`, k.store Ids); "the dev output" is the child's stdout and stderr together.
import { mkdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fixedTime, testTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { ROOT, until } from "./derived-support.ts";
import { type Dev, get, startDev } from "./evaluator-support.ts";

const SLOW = testTime(600_000);
const START = 120_000;
const NEXT = fixedTime(60_000);
const X = "modules/a/x.ts";
const Y = "modules/a/y.ts";
const PATH = "/api/a/one";

/** A file exporting `version` and a module-level store per id (exported under its id's last segment). */
const storeFile = (version: string, ids: readonly string[]): string =>
  `import { s as k } from "@keel/schema";
import { store } from "@keel/store";
export const version = ${JSON.stringify(version)};
${ids.map((id) => `export const ${id.split(".")[1] ?? ""} = store(k.object({ n: k.int() }), { n: 0 }, { id: ${JSON.stringify(id)} });`).join("\n")}
`;
const ROUTES = `import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import * as x from "./x.ts";
import * as y from "./y.ts";
const Out = s.object({ tag: s.string() });
const a = contract("a", { "a.get": { method: "GET", path: ${JSON.stringify(PATH)}, output: Out } });
const one = loader(a, "a.get", {}, () => Promise.resolve(ok({ tag: x.version + "/" + y.version })));
export const routes = manifest(a, { "a.get": { loader: one } });
`;

let fixture = "";
const write = (rel: string, content: string): void => {
  const file = join(fixture, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};
const devs: Dev[] = [];
afterAll(async () => {
  for (const d of devs) await d.stop();
});
beforeEach(() => {
  fixture = realpathSync(tempDir("keel-dev-store-ids-"));
  for (const p of ["compiler", "ctx", "reactive", "router", "runtime-dom", "schema", "store", "server"]) {
    mkdirSync(join(fixture, "node_modules", "@keel"), { recursive: true });
    symlinkSync(join(ROOT, "packages", p), join(fixture, "node_modules", "@keel", p));
  }
  symlinkSync(join(ROOT, "node_modules", "vite"), join(fixture, "node_modules", "vite"));
  mkdirSync(join(fixture, "node_modules", ".bin"), { recursive: true });
  symlinkSync("../vite/bin/vite.js", join(fixture, "node_modules", ".bin", "vite"));
  write("package.json", `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`);
  write(
    "topology.ts",
    'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["a"], adapter: "node" } });\n',
  );
  write(
    "vite.config.ts",
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  );
  write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
    }),
  );
  write(
    "modules/a/module.ts",
    'import { module } from "@keel/compiler";\nexport default module({ id: "a", deps: [], capabilities: [], public: { exports: [] } });\n',
  );
  write("modules/a/routes.ts", ROUTES);
  write(X, storeFile("x0", ["a.s"]));
  write(Y, storeFile("y0", []));
});

/** The loader's `tag`, `undefined` while the server answers anything else. */
async function tagOf(dev: Dev): Promise<string | undefined> {
  const r = await get(dev.port, PATH);
  if (r === undefined || r.status !== 200) return undefined;
  try {
    const body: unknown = JSON.parse(r.body);
    const results = typeof body === "object" && body !== null ? Reflect.get(body, "results") : undefined;
    const entry = typeof results === "object" && results !== null ? Reflect.get(results, "a.get") : undefined;
    const value = typeof entry === "object" && entry !== null ? Reflect.get(entry, "value") : undefined;
    const tag = typeof value === "object" && value !== null ? Reflect.get(value, "tag") : undefined;
    return typeof tag === "string" ? tag : undefined;
  } catch {
    return undefined;
  }
}

/** True once a request answers `want`, within `NEXT`. */
const answers = (dev: Dev, want: string): Promise<boolean> => until(async () => (await tagOf(dev)) === want, NEXT);

/** True once the dev output holds `text`, requesting again on each poll, within `NEXT`. */
const prints = (dev: Dev, text: string): Promise<boolean> =>
  until(async () => {
    await get(dev.port, PATH);
    return dev.output().includes(text);
  }, NEXT);

async function serve(): Promise<Dev> {
  const dev = await startDev(fixture, START, {});
  devs.push(dev);
  expect(dev.child.exitCode, dev.output()).toBeNull();
  expect(await answers(dev, "x0/y0"), dev.output().slice(-600)).toBe(true);
  expect(dev.output()).not.toContain("already in use");
  return dev;
}

describe("k.data Dev: a module-level store keeps its id from one load to the next", () => {
  test(
    "under `keel dev`, with `modules/a/x.ts` holding a module-level store of id `a.s` and `modules/a/y.ts` left without one, both imported by `modules/a/routes.ts`, editing `y.ts` to add a module-level store of id `a.s` makes the dev output hold `already in use` on the next request",
    async () => {
      const dev = await serve();
      write(Y, storeFile("y1", ["a.s"]));
      expect(await prints(dev, "already in use"), dev.output().slice(-600)).toBe(true);
      await dev.stop();
    },
    SLOW,
  );

  test(
    "under `keel dev`, in that app before the edit to `y.ts`, editing `x.ts` to rename its store's id from `a.s` to `a.t` and, after the next request, editing `y.ts` to add a module-level store of id `a.s` leaves the dev output without `already in use` on the request after that; a second edit of `y.ts` adding one more of id `a.t` makes it hold `store a.t: id already in use by a live store`",
    async () => {
      const dev = await serve();
      write(X, storeFile("x1", ["a.t"]));
      expect(await answers(dev, "x1/y0"), dev.output().slice(-600)).toBe(true);
      write(Y, storeFile("y1", ["a.s"]));
      expect(await answers(dev, "x1/y1"), dev.output().slice(-600)).toBe(true);
      expect(dev.output()).not.toContain("already in use");
      write(Y, storeFile("y2", ["a.s", "a.t"]));
      expect(await prints(dev, "store a.t: id already in use by a live store"), dev.output().slice(-600)).toBe(true);
      await dev.stop();
    },
    SLOW,
  );
});
