// Spec: k.bundle, Conformance "A page importing `node:sqlite` fails `vite build` with E1007 `node built-in`, with or without `sqlite` in the running Node's built-in list; the server build maps it."
// Spec: k.bundle, Node built-ins "The Assertion's Node built-ins are every `node:` specifier and every bare name a supported Node version (22 and later) lists, from a list Keel ships, not the running Node's; so `node:sqlite` fails a browser build on every supported version. A browser build maps no built-in to a module; `node:sqlite`'s mapping is the server build's."
// Seed 1337 (no random input: the two Node lists are enumerated). `vite build` with `KEEL_DEPLOYABLE=api` over a temp project, once with the running Node's list and once with `sqlite` taken out of it.
// "Without `sqlite` in the running Node's list": the child process is started with `NODE_OPTIONS=--require=<project>/no-sqlite.cjs`, which replaces `module.builtinModules` with a copy without `sqlite` and `node:sqlite` and makes `module.isBuiltin` answer false for them, as an older Node's list would. A first test reads the list in a child with the same option, so a preload that did nothing cannot make the others pass.
// The server build's half runs `keel build` over a fixture whose `load.server.ts` imports `node:sqlite` (a Node of 22.5 or later is required, as the spec's `node:sqlite` is).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { built, filesHolding, filesUnder, linesWith, nodeTree, viteBuild } from "./boundary-support.ts";
import { chainOf, inProject, nodeWith, page, reasonOf } from "./bundle-support.ts";

const PRELOAD = `const m = require("node:module");
const keep = (n) => String(n).replace(/^node:/, "") !== "sqlite";
m.builtinModules = Object.freeze(m.builtinModules.filter(keep));
const was = m.isBuiltin;
m.isBuiltin = (n) => keep(n) && was(n);
`;

const fixture = () =>
  nodeWith({
    "modules/a/util.ts":
      "import { DatabaseSync } from 'node:sqlite'\nexport const util = (): string => typeof DatabaseSync\n",
    "modules/a/Page.tsx": page("import { util } from './util.ts'", "util()"),
    "no-sqlite.cjs": PRELOAD,
  });

const listed = (dir: string, stripped: boolean): string => {
  const env = stripped ? { NODE_OPTIONS: `--require=${join(dir, "no-sqlite.cjs")}` } : {};
  const r = spawnSync(
    process.execPath,
    [
      "-p",
      "String(require('node:module').builtinModules.some((n) => n.replace(/^node:/, '') === 'sqlite') || require('node:module').isBuiltin('node:sqlite'))",
    ],
    { encoding: "utf8", env: { ...process.env, ...env, NODE_OPTIONS: env.NODE_OPTIONS ?? "" } },
  );
  return r.stdout.trim();
};

describe("k.bundle Node built-ins: `node:sqlite` fails a browser build whatever the running Node lists", () => {
  test("the preload removes `sqlite` from the list a child Node reports", async () => {
    await inProject(fixture(), (dir) => {
      expect(listed(dir, true)).toBe("false");
    });
  });

  for (const stripped of [false, true]) {
    test(`a page importing \`node:sqlite\` through \`util.ts\`, ${stripped ? "with `sqlite` removed from the running Node's built-in list" : "with the running Node's list"}: \`vite build\` exits 1 with one E1007 \`node built-in\` ending \`modules/a/Page.tsx -> modules/a/util.ts -> node:sqlite\`, and writes nothing`, async () => {
      await inProject(fixture(), (dir) => {
        const env = stripped ? { NODE_OPTIONS: `--require=${join(dir, "no-sqlite.cjs")}` } : {};
        const r = viteBuild(dir, "api", env);
        expect(r.status, r.out).toBe(1);
        const hits = linesWith(r.out, "E1007");
        expect(hits, r.out).toHaveLength(1);
        expect(reasonOf(hits[0] ?? "")).toBe("node built-in");
        expect(chainOf(hits[0] ?? "").slice(-3)).toEqual(["modules/a/Page.tsx", "modules/a/util.ts", "node:sqlite"]);
        expect(existsSync(join(dir, "dist", "api"))).toBe(false);
        expect(filesUnder(join(dir, "dist"))).toEqual([]);
      });
    });
  }
});

describe("k.bundle Node built-ins: the server build maps `node:sqlite`", () => {
  const tree = () => {
    const base = nodeTree("node")["modules/a/load.server.ts"] ?? "";
    return nodeWith({
      "modules/a/load.server.ts": `import { DatabaseSync } from 'node:sqlite'\n${base.replace("Reflect.set(globalThis, 'loaderRan'", "Reflect.set(globalThis, 'dbType', typeof DatabaseSync)\n  Reflect.set(globalThis, 'loaderRan'")}`,
    });
  };

  test("a `load.server.ts` importing `node:sqlite`: `keel build` exits 0, `server.mjs` names `node:sqlite` and no browser file under `dist/api/` does", async () => {
    await inProject(tree(), (dir) => {
      const r = built(dir);
      expect(r.status, r.out).toBe(0);
      expect(readFileSync(join(dir, "dist", "api", "server.mjs"), "utf8")).toContain("node:sqlite");
      expect(filesHolding(join(dir, "dist", "api", "assets"), "sqlite")).toEqual([]);
    });
  });
});
