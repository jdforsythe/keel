// Spec: k.boundary, Conformance "A `client` deployable it hosts ships its own `*.server.ts` loader and none of those canaries; a `static` fixture's browser build ships none of its own."
// Spec: k.boundary, Server-only "A server-only file is a file named `*.server.*` or `*.guard.*`, in the app or a package, unless its module is one only `client` deployables list (a file under `modules/<id>/` is module `<id>`'s, a stdlib package's file its module's; a file outside every module is server-only). In a module a `node` or `static` deployable lists, loaders and actions (E1551) and guards (E1009) live in server-only files and run only on the server or at build; no byte of a server-only file, nor of what only server-only files import, is in an asset served to a browser. In a module only `client` deployables list nothing is server-only: its `*.server.*` and `*.guard.*` files hold the loaders, actions and guards the browser runs (k.router), are browser files (k.host) and ship like any other."
// Seed 1337 (no random input: one fixture, built once; one variant for the Node built-in). The real binary and `vite build` over a temp project with `@keel/*` linked.
// Node `api` lists module `a`; `client` `web` (`host: 'api'`) lists module `w`, whose `*.server.ts` loader and `*.guard.ts` guard run in the browser.
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  CANARY,
  SLOW,
  built,
  cleanup,
  clientTree,
  filesHolding,
  keelRun,
  linesWith,
  materialize,
  viteBuild,
  withFiles,
} from "./boundary-support.ts";

const A = ["loader", "action", "guard", "deep", "side"] as const;
const SERVER_FILES = ["server.mjs", "server.mjs.map"];

let dir = "";
let bad = "";
let result: ReturnType<typeof built>;
let badBuild: ReturnType<typeof viteBuild>;
beforeAll(() => {
  dir = materialize(clientTree());
  bad = materialize(
    withFiles(clientTree(), {
      "modules/w/loadW.server.ts":
        "import { existsSync } from 'node:fs'\nimport { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { Out } from './Out.schema.ts'\n" +
        "export const loadW = loader({ output: Out }, async () => ok({ title: existsSync('/') ? 'w' : 'v' }))\n",
    }),
  );
  result = built(dir);
  badBuild = viteBuild(bad, "web");
}, SLOW);
afterAll(() => {
  cleanup(dir);
  cleanup(bad);
});

describe("k.boundary: a `client` deployable hosted by a `node` one ships its handler files and none of the `node` module's server-only code", () => {
  test("the build exits 0", () => {
    expect(result.status, result.out).toBe(0);
  });

  test("`dist/web/` holds the canary of its own `*.server.ts` loader and its own `*.guard.ts` guard: they run in the browser", () => {
    expect(result.status, result.out).toBe(0);
    expect(filesHolding(join(dir, "dist", "web", "assets"), CANARY.client)).not.toEqual([]);
    expect(filesHolding(join(dir, "dist", "web", "assets"), CANARY.clientGuard)).not.toEqual([]);
  });

  for (const key of A) {
    test(`the ${key} canary of the \`node\` module is in no file of \`dist/web/\``, () => {
      expect(result.status, result.out).toBe(0);
      expect(filesHolding(join(dir, "dist", "web"), CANARY[key])).toEqual([]);
    });

    test(`the ${key} canary of the \`node\` module is in no file of \`dist/api/\` but \`server.mjs\` and its map, the copied \`web\` included`, () => {
      expect(result.status, result.out).toBe(0);
      expect(filesHolding(join(dir, "dist", "api"), CANARY[key], SERVER_FILES)).toEqual([]);
    });
  }

  test("the hosted copy of `web` under `dist/api/` holds the client's handler canaries as `dist/web/` does", () => {
    expect(result.status, result.out).toBe(0);
    expect(filesHolding(join(dir, "dist", "api", "assets"), CANARY.client)).not.toEqual([]);
  });
});

describe("k.boundary: in a module only `client` deployables list the handler files are browser files", () => {
  test("a `node:fs` import in `modules/w/loadW.server.ts` is one E1759 at that file from `keel check`", () => {
    const r = keelRun(bad, ["check"]);
    const hits = linesWith(r.out, '"E1759"').filter((l) => l.includes("modules/w/loadW.server.ts"));
    expect(hits).toHaveLength(1);
  });

  test("the same import fails `vite build` for `web` with exit 1 and one E1007 ending `-> modules/w/loadW.server.ts -> node:fs`", () => {
    expect(badBuild.status, badBuild.out).toBe(1);
    expect(badBuild.out).toContain("E1007");
    const hits = linesWith(badBuild.out, "E1007");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(
      /server code in browser build: node built-in: .*-> modules\/w\/loadW\.server\.ts -> node:fs$/,
    );
  });

  test("a failed browser build writes nothing for its deployable", () => {
    expect(badBuild.status, badBuild.out).toBe(1);
    expect(filesHolding(join(bad, "dist", "web"), "")).toEqual([]);
  });
});
