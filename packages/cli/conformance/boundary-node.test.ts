// Spec: k.boundary, clause "In a `node` fixture, canaries in a `*.server.ts` loader, an action, a `*.guard.ts` guard, a module two imports past the loader and a `*.server.ts` top-level statement are in no file under `dist/<name>/assets/`; the resumed page's `Link` and `Form` carry a contract's `href` with typed params, and a post runs the action."
// k.boundary, Server-only "A server-only file is a file named `*.server.*` or `*.guard.*`, in the app or a package, unless its module is one only `client` deployables list (a file under `modules/<id>/` is module `<id>`'s, a stdlib package's file its module's; a file outside every module is server-only). In a module a `node` or `static` deployable lists, loaders and actions (E1551) and guards (E1009) live in server-only files and run only on the server or at build; no byte of a server-only file, nor of what only server-only files import, is in an asset served to a browser. In a module only `client` deployables list nothing is server-only: its `*.server.*` and `*.guard.*` files hold the loaders, actions and guards the browser runs (k.router), are browser files (k.host) and ship like any other."
// Seed 1337 (no random input: one fixture per placement, built once each). The real binary over a temp project with `@keel/*` and `vite` linked.
// A canary is a distinct constant written into one fixture file; every file a build emits for a browser is searched, not just the entry chunks.
// The resumed page in a browser is not driven here: the served document carries the `Link` and `Form` the client entry claims.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  CANARY,
  SLOW,
  built,
  cleanup,
  filesHolding,
  filesUnder,
  materialize,
  nodeTree,
  send,
  viteBuild,
  withServer,
} from "./boundary-support.ts";

const SERVER_FILES = ["server.mjs", "server.mjs.map"];

let node = "";
let stat = "";
let bare = "";
let nodeBuild: ReturnType<typeof built>;
let statBuild: ReturnType<typeof viteBuild>;
let bareBuild: ReturnType<typeof viteBuild>;
beforeAll(() => {
  node = materialize(nodeTree("node"));
  stat = materialize(nodeTree("static"));
  bare = materialize(nodeTree("none"));
  nodeBuild = built(node);
  statBuild = viteBuild(stat, "web");
  bareBuild = viteBuild(bare, undefined);
}, SLOW);
afterAll(() => {
  for (const d of [node, stat, bare]) cleanup(d);
});

const BROWSER = ["loader", "action", "guard", "deep", "side"] as const;

describe("k.boundary: a `node` deployable's browser assets hold no server-only code", () => {
  test("the build exits 0 and writes `dist/api/assets/`", () => {
    expect(nodeBuild.status, nodeBuild.out).toBe(0);
    expect(readdirSync(join(node, "dist", "api", "assets")).length).toBeGreaterThan(0);
  });

  for (const key of BROWSER) {
    test(`the ${key} canary is in no file under \`dist/api/assets/\` and in no browser file of \`dist/api/\``, () => {
      expect(nodeBuild.status, nodeBuild.out).toBe(0);
      expect(filesHolding(join(node, "dist", "api", "assets"), CANARY[key])).toEqual([]);
      expect(filesHolding(join(node, "dist", "api"), CANARY[key], SERVER_FILES)).toEqual([]);
    });
  }

  test("`server.mjs` still holds each canary: the code is not deleted, it runs on the server", () => {
    const text = readFileSync(join(node, "dist", "api", "server.mjs"), "utf8");
    for (const key of BROWSER) expect(text, key).toContain(CANARY[key]);
  });
});

describe("k.boundary: the served page of a built `node` deployable still works", () => {
  test(
    "`Link` and `Form` carry a contract's `href` with typed params and search, and a post runs the action",
    async () => {
      expect(nodeBuild.status, nodeBuild.out).toBe(0);
      const mark = join(node, "action-ran.txt");
      await withServer(node, "api", { K_MARK: mark }, async (port) => {
        const page = await send(port, "GET", "/a/x?tab=b", { accept: "text/html" });
        expect(page.status).toBe(200);
        expect(page.body).toContain('href="/a/x?tab=b"');
        expect(page.body).toContain('action="/a/x"');
        expect(page.body).not.toContain("E1008");
        expect(existsSync(mark)).toBe(false);
        const posted = await send(
          port,
          "POST",
          "/a/x",
          { accept: "text/html", "content-type": "application/x-www-form-urlencoded", "sec-fetch-site": "same-origin" },
          "note=hello",
        );
        expect(posted.status).toBe(303);
        expect(readFileSync(mark, "utf8")).toBe(CANARY.action);
      });
    },
    SLOW,
  );
});

describe("k.boundary: a `static` deployable's browser build ships none of its server-only code", () => {
  test("the build exits 0 and emits files", () => {
    expect(statBuild.status, statBuild.out).toBe(0);
    expect(filesUnder(join(stat, "dist")).length).toBeGreaterThan(0);
  });

  for (const key of ["loader", "guard", "deep", "side"] as const) {
    test(`the ${key} canary is in no file under \`dist/\``, () => {
      expect(statBuild.status, statBuild.out).toBe(0);
      expect(filesHolding(join(stat, "dist"), CANARY[key])).toEqual([]);
    });
  }
});

describe("k.boundary: with no `topology.ts` the browser build holds no server-only code, as on `node`", () => {
  test("the build exits 0 and emits files", () => {
    expect(bareBuild.status, bareBuild.out).toBe(0);
    expect(filesUnder(join(bare, "dist")).length).toBeGreaterThan(0);
  });

  for (const key of ["loader", "guard", "deep", "side"] as const) {
    test(`the ${key} canary is in no file under \`dist/\``, () => {
      expect(bareBuild.status, bareBuild.out).toBe(0);
      expect(filesHolding(join(bare, "dist"), CANARY[key])).toEqual([]);
    });
  }
});
