// Mutation-killing tests for evaluateProject (build-time tokens.ts, contract and routes.ts evaluation).
import fs from "node:fs";
import path from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
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
  root = tempDir(".tmp-eval-", import.meta.dirname);
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

/** A binding file whose contract sits beside it: evaluation reads it as it reads a contract file. */
const binding = (id: string, entries: string, bound: string): string =>
  `import { action, guard, loader, manifest } from "@keel/router";\nimport { contract } from "@keel/router/contract";\nimport { ok, s } from "@keel/schema";\nconst c = contract("${id}", { ${entries} });\nconst V = () => null;\nexport const routes = manifest(c, { ${bound} });\n`;
const ROOT_VARS =
  ":root{color-scheme:light;--k-color-fg:#111;--k-color-bg:#fff;--k-space-1:4px;--k-space-2:8px}\n@layer keel.base{\n[hidden]{display:none!important}\ntable{overflow-wrap:break-word}\nth{text-align:inherit}\n.k-scroll{overflow-x:auto;min-width:0}\nbody{overflow-wrap:anywhere}\n.k-summary ul{list-style:none;margin:0;padding:0}\n}\n";

describe("evaluateProject (mutation)", () => {
  it("returns an empty result without inputs", async () => {
    expect(await evaluateProject({ root, tokensFile: undefined, routesFiles: [], usages: [] })).toEqual({
      css: "",
      looks: {},
      schemes: ["light"],
      themes: [],
      routes: {},
      problems: [],
    });
  });

  it("compiles the CSS of a default-exported tokens file", { timeout: fixedTime(30000) }, async () => {
    const r = await evaluateProject({
      root,
      tokensFile: "tokens.ts",
      routesFiles: [],
      usages: [{ props: { p: "1", bg: "bg" } }, { props: { p: "2" }, breakpoint: "md", state: "hover" }],
    });
    expect(r).toEqual({
      css: `${ROOT_VARS}.k-p-1{padding:var(--k-space-1)}\n.k-bg-bg{background-color:var(--k-color-bg)}\n@media (min-width: 768px){\n.k-md-hover-p-2:hover{padding:var(--k-space-2)}\n}\n`,
      looks: {},
      schemes: ["light"],
      themes: [],
      routes: {},
      problems: [],
    });
  });

  it(
    "prefers the named `tokens` export and drops unknown-token usages with one problem each",
    { timeout: fixedTime(30000) },
    async () => {
      const r = await evaluateProject({
        root,
        tokensFile: "tokens2.ts",
        routesFiles: [],
        usages: [{ props: { p: "1" } }, { props: { p: "9" } }, { props: { p: "9", bg: "zz" } }],
      });
      expect(r).toEqual({
        css: `${ROOT_VARS}.k-p-1{padding:var(--k-space-1)}\n`,
        looks: {},
        schemes: ["light"],
        themes: [],
        routes: {},
        problems: ['E1801 p="9" is not a space token'],
      });
    },
  );

  it(
    "reports a token value that breaks out of CSS and falls back to empty CSS",
    { timeout: fixedTime(30000) },
    async () => {
      const r = await evaluateProject({
        root,
        tokensFile: "tokens3.ts",
        routesFiles: [],
        usages: [{ props: { p: "1" } }],
      });
      expect(r).toEqual({
        css: "",
        looks: {},
        schemes: ["light"],
        themes: [],
        routes: {},
        problems: ["E1807 token color.fg is not in its group's form"],
      });
    },
  );

  it("uses E1807 for errors without a code", { timeout: fixedTime(30000) }, async () => {
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

  // routes.json is the router's `routesArtifact` of each binding, merged and sorted by id.
  it("merges route tables sorted by id", { timeout: fixedTime(30000) }, async () => {
    write(
      "r/a.ts",
      binding(
        "z",
        `"z.x": { path: "/z" }, "z.shell": { layout: true }, "z.box": { method: "GET", path: "/api/z", output: s.object({}) }, "z.add": { method: "POST", path: "/api/z", output: s.object({}) }`,
        `"z.x": { component: V, layout: "z.shell", guard: guard({ redirect: "z.x" }, async () => ok(null)) }, "z.shell": { component: V }, "z.box": { loader: loader(c, "z.box", {}, async () => ok({})) }, "z.add": { action: action(c, "z.add", {}, async () => ok({})) }`,
      ),
    );
    write("r/b.ts", binding("a", `"a.y": { path: "/a" }`, `"a.y": { component: V }`));
    const r = await evaluateProject({
      root,
      tokensFile: undefined,
      routesFiles: ["r/a.ts", "r/b.ts"],
      usages: [{ props: { p: "1" } }],
    });
    expect(r.css).toBe("");
    expect(r.problems).toEqual([]);
    expect(Object.keys(r.routes)).toEqual(["a.y", "z.add", "z.box", "z.shell", "z.x"]);
    expect(r.routes["a.y"]).toEqual({
      actions: [],
      guard: null,
      layout: null,
      module: "a",
      params: null,
      path: "/a",
      search: null,
    });
    expect(r.routes["z.x"]).toMatchObject({ guard: "z.x", layout: "z.shell", path: "/z" });
    expect(r.routes["z.shell"]).toMatchObject({ path: null, layout: null });
    expect(r.routes["z.box"]).toMatchObject({ api: true, method: "GET", actions: [], path: "/api/z" });
    expect(r.routes["z.add"]).toMatchObject({ api: true, method: "POST", actions: ["POST"] });
  });

  it("evaluates tokens and routes together", { timeout: fixedTime(30000) }, async () => {
    write("r/a.ts", binding("m", `"m.index": { path: "/" }`, `"m.index": { component: V }`));
    const r = await evaluateProject({
      root,
      tokensFile: "tokens.ts",
      routesFiles: ["r/a.ts"],
      usages: [{ props: { p: "2" } }],
    });
    expect(r.css).toBe(`${ROOT_VARS}.k-p-2{padding:var(--k-space-2)}\n`);
    expect(Object.keys(r.routes)).toEqual(["m.index"]);
  });

  it("rejects when an input cannot be bundled", { timeout: fixedTime(30000) }, async () => {
    await expect(evaluateProject({ root, tokensFile: "missing.ts", routesFiles: [], usages: [] })).rejects.toThrow(
      /Could not resolve/,
    );
  });
});

describe("evaluateProject error mapping (0090)", () => {
  const run = (tokensFile: string) =>
    evaluateProject({ root, tokensFile, routesFiles: [], usages: [{ props: { p: "1" } }] });

  it(
    "maps a tokens module that throws while evaluating to E1807 with the real message",
    { timeout: fixedTime(30000) },
    async () => {
      write("t-throw.ts", `throw new Error("boom at load");`);
      const r = await run("t-throw.ts");
      expect(r.css).toBe("");
      expect(r.problems).toEqual(["E1807 t-throw.ts failed to evaluate: boom at load"]);
    },
  );

  it(
    "passes a diagnostic-shaped error that carries a code through unchanged",
    { timeout: fixedTime(30000) },
    async () => {
      write("t-coded.ts", `throw Object.assign(new Error("custom diag"), { code: "E1234" });`);
      expect((await run("t-coded.ts")).problems).toEqual(["E1234 custom diag"]);
    },
  );

  it(
    "rethrows an internal compiler failure with its real message instead of an app code",
    { timeout: fixedTime(30000) },
    async () => {
      write("t-internal.ts", `export const tokens = { color: { get fg(): string { throw new Error("kaput"); } } };`);
      await expect(run("t-internal.ts")).rejects.toMatchObject({
        code: "E1049",
        message: "internal compiler failure: build-time evaluation: kaput",
      });
    },
  );
});

describe("evaluateProject routes.ts and syntax errors (RFC 0030)", () => {
  const routesOnly = (...routesFiles: string[]) =>
    evaluateProject({ root, tokensFile: undefined, routesFiles, usages: [] });

  it("maps a routes.ts that throws to E1006 and keeps the other manifests", { timeout: fixedTime(30000) }, async () => {
    write("r/throw.ts", `throw new Error("routes boom");\nexport const routes = {};`);
    write("r/ok.ts", binding("m", `"m.index": { path: "/" }`, `"m.index": { component: V }`));
    const r = await routesOnly("r/throw.ts", "r/ok.ts");
    expect(r.problems).toEqual(["E1006 r/throw.ts failed to evaluate: routes boom"]);
    expect(Object.keys(r.routes)).toEqual(["m.index"]);
  });

  it("maps a routes.ts without a routes export to E1006", { timeout: fixedTime(30000) }, async () => {
    write("r/none.ts", "export const other = 1;");
    expect(await routesOnly("r/none.ts")).toEqual({
      css: "",
      looks: {},
      schemes: ["light"],
      themes: [],
      routes: {},
      problems: ["E1006 r/none.ts exports no routes"],
    });
  });

  it("maps a routes export that is no route table to E1006", { timeout: fixedTime(30000) }, async () => {
    write("r/plain.ts", `export const routes = { routes: { "m.index": { path: "/" } } };`);
    expect((await routesOnly("r/plain.ts")).problems).toEqual(["E1006 r/plain.ts exports no route table"]);
  });

  it(
    "maps a contract file that throws to E1006 naming it, and runs no binding of it",
    { timeout: fixedTime(30000) },
    async () => {
      write("modules/a/a.contract.ts", `throw new Error("contract boom");\nexport const a = 1;`);
      write("modules/a/routes.ts", `throw new Error("binding ran");\nexport const routes = {};`);
      write("modules/b/routes.ts", binding("b", `"b.index": { path: "/" }`, `"b.index": { component: V }`));
      const r = await routesOnly("modules/a/routes.ts", "modules/b/routes.ts");
      expect(r.problems).toEqual(["E1006 modules/a/a.contract.ts failed to evaluate: contract boom"]);
      expect(Object.keys(r.routes)).toEqual(["b.index"]);
    },
  );

  it("keeps the code of a coded contract throw", { timeout: fixedTime(30000) }, async () => {
    write(
      "modules/a/a.contract.ts",
      `throw Object.assign(new Error("bad entry"), { code: "E1510" });\nexport const a = 1;`,
    );
    write("modules/a/routes.ts", "export const routes = {};");
    expect((await routesOnly("modules/a/routes.ts")).problems).toEqual(["E1510 bad entry"]);
  });

  it("keeps the code of a coded routes.ts throw", { timeout: fixedTime(30000) }, async () => {
    write("r/coded.ts", `throw Object.assign(new Error("dup path"), { code: "E1502" });\nexport const routes = {};`);
    expect((await routesOnly("r/coded.ts")).problems).toEqual(["E1502 dup path"]);
  });

  it(
    "treats a codeless throw while deriving the artifact as internal (E1049)",
    { timeout: fixedTime(30000) },
    async () => {
      write("r/bad.ts", `export const routes = { get kind() { throw new Error("kaput"); } };`);
      await expect(routesOnly("r/bad.ts")).rejects.toMatchObject({
        code: "E1049",
        message: "internal compiler failure: build-time evaluation: kaput",
      });
    },
  );

  it(
    "reports a syntax error in an evaluated module as E1000 at its location",
    { timeout: fixedTime(30000) },
    async () => {
      write("r/syntax.ts", `export const routes = { routes: { "a": { path: "/a" } };`);
      write("tsyn.ts", "export const tokens = {;");
      expect(await routesOnly("r/syntax.ts")).toEqual({
        css: "",
        looks: {},
        schemes: ["light"],
        themes: [],
        routes: {},
        problems: ["E1000 r/syntax.ts:1:56 syntax error: Expected `,` or `}` but found `;`"],
      });
      const t = await evaluateProject({ root, tokensFile: "tsyn.ts", routesFiles: [], usages: [] });
      expect(t.problems).toHaveLength(1);
      expect(t.problems[0]).toMatch(/^E1000 tsyn\.ts:1:\d+ syntax error: /);
    },
  );

  it("rethrows a build failure that is not a syntax error unchanged", { timeout: fixedTime(30000) }, async () => {
    write("r/missing.ts", `import { x } from "./nowhere.ts";\nexport const routes = x;`);
    await expect(routesOnly("r/missing.ts")).rejects.toThrow(/Could not resolve "\.\/nowhere\.ts"/);
  });
});
