// Mutation-killing tests for listSources, entryCode and mergeArtifacts.
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { entryCode } from "../src/internal/entryCode.ts";
import { listSources } from "../src/internal/listSources.ts";
import { mergeArtifacts } from "../src/internal/mergeArtifacts.ts";
import type { A11yEntry } from "../src/types/A11yEntry.ts";
import type { Artifacts } from "../src/types/Artifacts.ts";
import type { IdEntry } from "../src/types/IdEntry.ts";
import type { RouteEntry } from "../src/types/RouteEntry.ts";

let root = "";
beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-mproj-"));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});
const touch = (rel: string): void => {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, "");
};

describe("listSources (mutation)", () => {
  it("lists sorted app code, skipping dot entries, skip dirs, tests and declarations", () => {
    for (const f of [
      "b.ts",
      "a.tsx",
      "c.mjs",
      "d.cjs",
      "e.js",
      "f.jsx",
      "g.mts",
      "h.cts",
      "readme.md",
      "x.css",
      "a.test.ts",
      "a.spec.tsx",
      "types.d.ts",
      ".hidden.ts",
      ".git/x.ts",
      "node_modules/m/i.ts",
      "dist/o.js",
      "coverage/c.js",
      "reports/r.js",
      "test/t.ts",
      "tests/t.ts",
      "conformance/c.ts",
      "src/deep/z.ts",
      "src/deep/y.ts",
      "src/.dot/q.ts",
      "src/node_modules/q.ts",
      "src/tests/q.ts",
      "notest.ts",
      "vite.config.ts",
      "src/x.config.tsx",
      "src/y.configs.ts",
      "types.d.mts",
    ])
      touch(f);
    expect(listSources(root)).toEqual([
      "a.tsx",
      "b.ts",
      "c.mjs",
      "d.cjs",
      "e.js",
      "f.jsx",
      "g.mts",
      "h.cts",
      "notest.ts",
      "src/deep/y.ts",
      "src/deep/z.ts",
      "src/y.configs.ts",
    ]);
  });

  it("returns [] for a missing root", () => {
    expect(listSources(path.join(root, "nope"))).toEqual([]);
  });

  it("skips symlinks that are neither files nor directories", () => {
    touch("real.ts");
    fs.symlinkSync(path.join(root, "real.ts"), path.join(root, "link.ts"));
    expect(listSources(root)).toEqual(["real.ts"]);
  });
});

describe("entryCode (mutation)", () => {
  const head = [
    'import "virtual:css";',
    'import { createCtx } from "@keel/ctx";',
    'import { browserHistory, createRouter, manifest } from "@keel/router";',
    'import { mount } from "@keel/runtime-dom";',
    'import { inspect } from "@keel/reactive";',
    'import { stores } from "@keel/store";',
    'import { inspectorSections } from "@keel/compiler/inspect/inspectorSections";',
  ];
  const tail = ['const ctx = createCtx({ mode: "real" });'];
  const rest = [
    'const el = document.getElementById("app");',
    'if (el === null) throw new Error("keel: index.html has no #app element");',
    'const mode = import.meta.env?.DEV === true ? "dev" : "production";',
    "mount(router.App, el, { ctx, mode });",
    "if (import.meta.env.DEV) {",
    '  let last = "";',
    "  const report = () => {",
    "    const live = {};",
    "    for (const [id, st] of stores()) {",
    "      const snap = st.snapshot();",
    "      live[id] = { state: snap.state, log: snap.log };",
    "    }",
    "    const body = JSON.stringify({ graph: inspect(), stores: live, sections: inspectorSections(ctx).sections });",
    "    if (body === last) return;",
    "    last = body;",
    '    const sent = fetch("/__keel/inspect", { method: "POST", headers: { "content-type": "application/json" }, body });',
    '    sent.catch(() => { last = ""; });',
    "  };",
    "  report();",
    "  setInterval(report, 1000);",
    "}",
    "",
  ];

  it("emits the exact entry for one routes file", () => {
    expect(entryCode(["/modules/a/routes.ts"], "virtual:css")).toBe(
      [
        ...head,
        'import { routes as __keelRoutes0 } from "/modules/a/routes.ts";',
        ...tail,
        "const router = createRouter(__keelRoutes0, { ctx, history: browserHistory() });",
        ...rest,
      ].join("\n"),
    );
  });

  it("merges several routes files into one manifest", () => {
    expect(entryCode(["/a.ts", "/b.ts"], "virtual:css")).toBe(
      [
        ...head,
        'import { routes as __keelRoutes0 } from "/a.ts";',
        'import { routes as __keelRoutes1 } from "/b.ts";',
        ...tail,
        "const router = createRouter(manifest({ ...__keelRoutes0.routes, ...__keelRoutes1.routes }), { ctx, history: browserHistory() });",
        ...rest,
      ].join("\n"),
    );
  });

  it("falls back to an empty manifest table for no routes files", () => {
    const code = entryCode([], "virtual:css");
    expect(code).toContain("const router = createRouter(manifest({  }), { ctx, history: browserHistory() });");
  });
});

const idEntry = (file: string, n = 0): IdEntry => ({ col: 1, component: "C", file, line: n, role: null, tag: "p" });
const a11y = (tag: string): A11yEntry => ({ name: "text", role: null, tag });
const route = (module: string): RouteEntry => ({
  actions: [],
  guard: null,
  layout: null,
  module,
  params: null,
  path: "/",
  search: null,
});
const part = (p: Partial<Artifacts>): Artifacts => ({
  "a11y.json": {},
  "deps.json": { edges: [], nodes: [] },
  "ids.json": {},
  "routes.json": {},
  "styles.json": { usages: [] },
  ...p,
});

describe("mergeArtifacts (mutation)", () => {
  it("returns empty artifacts and no duplicates for no parts", () => {
    const r = mergeArtifacts([]);
    expect(r.duplicates).toEqual([]);
    expect(r.artifacts["deps.json"]).toEqual({ edges: [], nodes: [] });
    expect(r.artifacts["styles.json"]).toEqual({ usages: [] });
    expect(Object.keys(r.artifacts["ids.json"])).toEqual([]);
  });

  it("sorts ids, a11y and routes by key and keeps the first id claim", () => {
    const r = mergeArtifacts([
      part({
        "ids.json": { b: idEntry("x.tsx", 1), c: idEntry("x.tsx", 2), a: idEntry("x.tsx", 3) },
        "a11y.json": { c: a11y("c"), a: a11y("a") },
        "routes.json": { r2: route("m1"), r1: route("m1") },
      }),
      part({
        "ids.json": { b: idEntry("y.tsx", 9), d: idEntry("y.tsx", 4) },
        "a11y.json": { b: a11y("dup"), d: a11y("d") },
        "routes.json": { r1: route("m2") },
      }),
    ]);
    expect(Object.keys(r.artifacts["ids.json"])).toEqual(["a", "b", "c", "d"]);
    expect(r.artifacts["ids.json"].b?.file).toBe("x.tsx");
    expect(r.duplicates).toEqual([{ id: "b", file: "y.tsx" }]);
    expect(Object.keys(r.artifacts["a11y.json"])).toEqual(["a", "c", "d"]);
    expect(Object.keys(r.artifacts["routes.json"])).toEqual(["r1", "r2"]);
    expect(r.artifacts["routes.json"].r1?.module).toBe("m2");
  });

  it("does not add an a11y entry for an id without one, and skips undefined id entries", () => {
    const withHole: Record<string, IdEntry> = Object.create(null);
    Reflect.set(withHole, "hole", undefined);
    const r = mergeArtifacts([
      part({ "ids.json": { k: idEntry("a.tsx"), hole: idEntry("a.tsx") } }),
      part({ "ids.json": withHole }),
      part({ "ids.json": { hole: idEntry("b.tsx") } }),
    ]);
    expect(Object.keys(r.artifacts["a11y.json"])).toEqual([]);
    expect(r.duplicates).toEqual([{ id: "hole", file: "b.tsx" }]);
    const r2 = mergeArtifacts([part({ "ids.json": { x: idEntry("a.tsx") }, "a11y.json": { x: a11y("p") } })]);
    expect(Object.keys(r2.artifacts["a11y.json"])).toEqual(["x"]);
    const r3 = mergeArtifacts([
      part({ "ids.json": { x: idEntry("a.tsx") } }),
      part({ "ids.json": { x: idEntry("b.tsx") }, "a11y.json": { x: a11y("late") } }),
    ]);
    expect(Object.keys(r3.artifacts["a11y.json"])).toEqual([]);
  });

  it("sorts nodes by id and edges by from then to, deduplicating both", () => {
    const node = (id: string) => ({ file: "f", id, kind: "signal" as const, name: id });
    const r = mergeArtifacts([
      part({
        "deps.json": {
          nodes: [node("b"), node("a"), node("c")],
          edges: [
            { from: "b", to: "a" },
            { from: "a", to: "c" },
            { from: "a", to: "b" },
          ],
        },
      }),
      part({
        "deps.json": {
          nodes: [node("a"), node("0")],
          edges: [
            { from: "a", to: "c" },
            { from: "c", to: "a" },
          ],
        },
      }),
    ]);
    expect(r.artifacts["deps.json"].nodes.map((n) => n.id)).toEqual(["0", "a", "b", "c"]);
    expect(r.artifacts["deps.json"].edges).toEqual([
      { from: "a", to: "b" },
      { from: "a", to: "c" },
      { from: "b", to: "a" },
      { from: "c", to: "a" },
    ]);
  });

  it("deduplicates and sorts style usages by their canonical form", () => {
    const r = mergeArtifacts([
      part({ "styles.json": { usages: [{ props: { p: "3" } }, { props: { p: "1" } }, { props: { p: "3" } }] } }),
      part({ "styles.json": { usages: [{ props: { p: "2" } }, { props: { p: "1" } }] } }),
    ]);
    expect(r.artifacts["styles.json"].usages).toEqual([
      { props: { p: "1" } },
      { props: { p: "2" } },
      { props: { p: "3" } },
    ]);
  });
});
