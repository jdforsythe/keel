// Mutation-killing tests for evaluateProject (build-time tokens.ts / routes.ts evaluation).
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluateProject } from "../src/internal/evaluateProject.ts";

const packages = path.dirname(fs.realpathSync(path.join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
let root = "";
const write = (rel: string, text: string): void => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-eval-"));
  fs.mkdirSync(path.join(root, "node_modules", "@keel"), { recursive: true });
  for (const p of fs.readdirSync(packages))
    if (fs.existsSync(path.join(packages, p, "package.json")))
      fs.symlinkSync(path.join(packages, p), path.join(root, "node_modules", "@keel", p));
  const body = `{ color: { fg: "#111", bg: "#fff" }, space: { 1: "4px", 2: "8px" }, breakpoint: { md: "768px" } }`;
  write("tokens.ts", `import { defineTokens } from "@keel/ui";\nexport default defineTokens(${body});`);
  write("tokens2.ts", `import { defineTokens } from "@keel/ui";\nexport const tokens = defineTokens(${body});`);
  write("tokens3.ts", `export const tokens = { color: { fg: "#1}11" }, space: { 1: "4px" } };`);
  write("tokens4.ts", "export const other = 1;");
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const ROOT_VARS = ":root{--k-color-fg:#111;--k-color-bg:#fff;--k-space-1:4px;--k-space-2:8px}\n";

describe("evaluateProject (mutation)", () => {
  it("returns an empty result without inputs", async () => {
    expect(await evaluateProject({ root, tokensFile: undefined, routesFiles: [], usages: [] })).toEqual({
      css: "",
      routes: {},
      problems: [],
    });
  });

  it("compiles the CSS of a default-exported tokens file", { timeout: 30000 }, async () => {
    const r = await evaluateProject({
      root,
      tokensFile: "tokens.ts",
      routesFiles: [],
      usages: [{ props: { p: "1", bg: "bg" } }, { props: { p: "2" }, breakpoint: "md", state: "hover" }],
    });
    expect(r).toEqual({
      css: `${ROOT_VARS}.k-p-1{padding:var(--k-space-1)}\n.k-bg-bg{background-color:var(--k-color-bg)}\n@media (min-width: 768px){\n.k-md-hover-p-2:hover{padding:var(--k-space-2)}\n}\n`,
      routes: {},
      problems: [],
    });
  });

  it(
    "prefers the named `tokens` export and drops unknown-token usages with one problem each",
    { timeout: 30000 },
    async () => {
      const r = await evaluateProject({
        root,
        tokensFile: "tokens2.ts",
        routesFiles: [],
        usages: [{ props: { p: "1" } }, { props: { p: "9" } }, { props: { p: "9", bg: "zz" } }],
      });
      expect(r).toEqual({
        css: `${ROOT_VARS}.k-p-1{padding:var(--k-space-1)}\n`,
        routes: {},
        problems: ['E1801 p="9" is not a space token'],
      });
    },
  );

  it("reports a token value that breaks out of CSS and falls back to empty CSS", { timeout: 30000 }, async () => {
    const r = await evaluateProject({
      root,
      tokensFile: "tokens3.ts",
      routesFiles: [],
      usages: [{ props: { p: "1" } }],
    });
    expect(r).toEqual({ css: "", routes: {}, problems: ["E1807 token color.fg has a value that breaks out of CSS"] });
  });

  it("uses E1807 for errors without a code", { timeout: 30000 }, async () => {
    const r = await evaluateProject({
      root,
      tokensFile: "tokens4.ts",
      routesFiles: [],
      usages: [{ props: { p: "1" } }],
    });
    expect(r.css).toBe("");
    expect(r.routes).toEqual({});
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]?.startsWith("E1807 ")).toBe(true);
    expect((r.problems[0] ?? "").length).toBeGreaterThan("E1807 ".length);
  });

  it("merges route manifests sorted by id, keeping only valid entries", { timeout: 30000 }, async () => {
    write(
      "r/a.ts",
      `export const routes = { routes: { "z.x": { path: "/z" }, "bad.guard": { path: "/", guard: 5 }, "g.ok": { path: null, guard: "gg", layout: "ll" }, "bad.layout": { layout: 7 }, "bad.path": { path: 9 } } };`,
    );
    write(
      "r/b.ts",
      `import data from "./data.ts.json";\nexport const routes = { routes: { [data.id]: { path: data.path } } };`,
    );
    write("r/data.ts.json", `{ "id": "a.y", "path": "/a" }`);
    const r = await evaluateProject({
      root,
      tokensFile: undefined,
      routesFiles: ["r/a.ts", "r/b.ts"],
      usages: [{ props: { p: "1" } }],
    });
    expect(r.css).toBe("");
    expect(r.problems).toEqual([]);
    expect(Object.keys(r.routes)).toEqual(["a.y", "g.ok", "z.x"]);
    expect(r.routes["a.y"]).toEqual({
      actions: [],
      guard: null,
      layout: null,
      module: "a",
      params: null,
      path: "/a",
      search: null,
    });
    expect(r.routes["g.ok"]).toEqual({
      actions: [],
      guard: "gg",
      layout: "ll",
      module: "g",
      params: null,
      path: null,
      search: null,
    });
  });

  it("evaluates tokens and routes together", { timeout: 30000 }, async () => {
    write("r/a.ts", `export const routes = { routes: { "m.index": { path: "/" } } };`);
    const r = await evaluateProject({
      root,
      tokensFile: "tokens.ts",
      routesFiles: ["r/a.ts"],
      usages: [{ props: { p: "2" } }],
    });
    expect(r.css).toBe(`${ROOT_VARS}.k-p-2{padding:var(--k-space-2)}\n`);
    expect(Object.keys(r.routes)).toEqual(["m.index"]);
  });

  it("rejects when an input cannot be bundled", { timeout: 30000 }, async () => {
    await expect(evaluateProject({ root, tokensFile: "missing.ts", routesFiles: [], usages: [] })).rejects.toThrow(
      /Could not resolve/,
    );
  });
});
