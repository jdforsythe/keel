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
  write("tokens.ts", `import { defineTokens } from "@keel/ui/tokens";\nexport default defineTokens(${body});`);
  write("tokens2.ts", `import { defineTokens } from "@keel/ui/tokens";\nexport const tokens = defineTokens(${body});`);
  write("tokens3.ts", `export const tokens = { color: { fg: "#1}11" }, space: { 1: "4px" } };`);
  write("tokens4.ts", "export const other = 1;");
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** A binding file whose contract sits beside it: evaluation reads it as it reads a contract file. */
const binding = (id: string, entries: string, bound: string): string =>
  `import { action, guard, loader, manifest } from "@keel/router";\nimport { contract } from "@keel/router/contract";\nimport { ok, s } from "@keel/schema";\nconst c = contract("${id}", { ${entries} });\nconst V = () => null;\nexport const routes = manifest(c, { ${bound} });\n`;
type Result = Awaited<ReturnType<typeof evaluateProject>>;
/** A result's data: without the files the bundle loaded and what its code asked (`inputs`, `observe`). */
const data = (r: Result): Omit<Result, "inputs" | "observe"> => {
  const { inputs: _inputs, observe: _observe, ...rest } = r;
  return rest;
};
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
    expect(data(r)).toEqual({
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
      expect(data(r)).toEqual({
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
      expect(data(r)).toEqual({
        css: "",
        looks: {},
        schemes: ["light"],
        themes: [],
        routes: {},
        problems: ["E1807 color.fg: not a color value"],
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
    expect(data(await routesOnly("r/none.ts"))).toEqual({
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

describe("evaluateProject observes its own reads (k.derived Derivation cache)", () => {
  it(
    "records each node:fs read, existence test and process.env name its code asks, apart for each evaluation",
    { timeout: fixedTime(30000) },
    async () => {
      write("min.txt", "2");
      write(
        "tokens5.ts",
        `import { readFileSync, existsSync } from "node:fs";\nimport { defineTokens } from "@keel/ui/tokens";\nconst n = Number(readFileSync(${JSON.stringify(path.join(root, "min.txt"))}, "utf8")) + Number(process.env.KEEL_EVAL_PROBE ?? "0");\nexistsSync("absent.txt");\nexport const tokens = defineTokens({ color: { fg: "#111" }, space: { 1: \`\${n}px\` } });`,
      );
      const a = await evaluateProject({ root, tokensFile: "tokens5.ts", routesFiles: [], usages: [] });
      const b = await evaluateProject({ root, tokensFile: "tokens.ts", routesFiles: [], usages: [] });
      const seen = a.observe?.();
      expect(seen?.reads).toContain(path.join(root, "min.txt"));
      expect(seen?.probes).toContainEqual(["exists", path.resolve("absent.txt")]);
      expect(seen?.env).toContainEqual(["KEEL_EVAL_PROBE", null]);
      expect(b.observe?.().reads ?? []).not.toContain(path.join(root, "min.txt"));
      expect(b.observe?.().env.map(([n]) => n) ?? []).not.toContain("KEEL_EVAL_PROBE");
    },
  );
});

describe("evaluateProject observes what it reads by another way, and refuses what it cannot observe", () => {
  const tokensWith = (head: string, n: string): string =>
    `${head}\nimport { defineTokens } from "@keel/ui/tokens";\nexport const tokens = defineTokens({ color: { fg: "#111" }, space: { 1: \`\${${n}}px\` } });`;
  const run = (file: string) => evaluateProject({ root, tokensFile: file, routesFiles: [], usages: [] });

  it(
    "records process.env read through globalThis, global and an alias, a computed require of a .json file and of node:fs, and a file it opened",
    { timeout: fixedTime(30000) },
    async () => {
      write("n.json", '{"n":3}');
      write("o.txt", "1");
      write(
        "tokens6.ts",
        tokensWith(
          `import { createRequire } from "node:module";\nimport { openSync, readSync, closeSync } from "node:fs";\nconst g = globalThis;\nconst { env } = g.process;\nconst req = createRequire(import.meta.url);\nconst name = ["n", "json"].join(".");\nconst fd = openSync(${JSON.stringify(path.join(root, "o.txt"))});\nreadSync(fd, new Uint8Array(1));\ncloseSync(fd);\nconst n = req(${JSON.stringify(`${root}/`)} + name).n + Number(env.KEEL_EVAL_A ?? "0") + Number(global.process.env.KEEL_EVAL_B ?? "0") + (req(["node", "fs"].join(":")).existsSync("absent2.txt") ? 1 : 0);`,
          "n",
        ),
      );
      const seen = (await run("tokens6.ts")).observe?.();
      expect(seen?.env).toContainEqual(["KEEL_EVAL_A", null]);
      expect(seen?.env).toContainEqual(["KEEL_EVAL_B", null]);
      expect(seen?.reads).toContain(fs.realpathSync(path.join(root, "n.json")));
      expect(seen?.reads).toContain(path.join(root, "o.txt"));
      expect(seen?.probes).toContainEqual(["exists", path.resolve("absent2.txt")]);
    },
  );

  it(
    "records a link inside a package on the path to a file it loaded as a realpath probe",
    { timeout: fixedTime(30000) },
    async () => {
      write("node_modules/p/package.json", '{"name":"p","type":"module","exports":{".":"./index.js"}}');
      write("node_modules/p/real.js", "export const n = 2;");
      fs.symlinkSync("real.js", path.join(root, "node_modules", "p", "index.js"));
      write("tokens7.ts", tokensWith('import { n } from "p";', "n"));
      const seen = (await run("tokens7.ts")).observe?.();
      expect(seen?.probes).toContainEqual(["realpath", path.join(root, "node_modules", "p")]);
      expect(seen?.probes).toContainEqual(["realpath", path.join(root, "node_modules", "p", "index.js")]);
    },
  );

  it(
    "imports node:child_process, node:net and node:dns, refuses a call of their functions with E1050, and refuses a .node addon at its import",
    { timeout: fixedTime(30000) },
    async () => {
      const head =
        'import { execSync } from "node:child_process";\nimport net from "node:net";\nimport * as dns from "node:dns";';
      write(
        "tokens8.ts",
        tokensWith(
          `${head}\nconst n = typeof execSync + typeof net.Socket + typeof dns.lookup === "functionfunctionfunction" ? 1 : 0;`,
          "n",
        ),
      );
      expect((await run("tokens8.ts")).problems).toEqual([]);
      write("tokens11.ts", tokensWith(`${head}\nconst n = String(execSync("true")).length;`, "n"));
      expect((await run("tokens11.ts")).problems.join("\n")).toMatch(
        /^E1050 tokens11\.ts:4:18 node:child_process\.execSync at build time/,
      );
      write("tokens12.ts", tokensWith(`${head}\nconst n = new net.Socket() ? 1 : 0;`, "n"));
      expect((await run("tokens12.ts")).problems.join("\n")).toMatch(
        /^E1050 tokens12\.ts:4:\d+ node:net\.Socket at build time/,
      );
      write("a.node", "");
      write("tokens13.ts", tokensWith('import a from "./a.node";\nconst n = a;', "n"));
      await expect(run("tokens13.ts")).rejects.toThrow(/tokens13\.ts:1:\d+: ERROR: E1050 the native addon \.\/a\.node/);
    },
  );

  it(
    "refuses a computed require of a code file, and a read by a descriptor it did not open, with E1050",
    { timeout: fixedTime(30000) },
    async () => {
      write("c.cjs", "module.exports = 1;");
      write(
        "tokens9.ts",
        tokensWith(
          `import { createRequire } from "node:module";\nconst n = createRequire(import.meta.url)(${JSON.stringify(root)} + "/c.cjs");`,
          "n",
        ),
      );
      expect((await run("tokens9.ts")).problems.join("\n")).toMatch(
        /^E1050 tokens9\.ts:2:\d+ a require or import\(\) of ".*c\.cjs", a code file/,
      );
      write(
        "tokens10.ts",
        tokensWith('import { readFileSync } from "node:fs";\nconst n = readFileSync(0).length;', "n"),
      );
      expect((await run("tokens10.ts")).problems.join("\n")).toMatch(
        /^E1050 tokens10\.ts:2:\d+ a read by file descriptor 0/,
      );
    },
  );

  it(
    "gives each module its own import.meta, resolves a createRequire name from its folder and records each lookup, an absent one too",
    { timeout: fixedTime(30000) },
    async () => {
      write("sub/d.json", '{"n":4}');
      write(
        "sub/m14.ts",
        'import { createRequire } from "node:module";\nconst req = createRequire(import.meta.url);\nlet absent = 0;\ntry { req(["absent-q", "x.json"].join("/")); } catch { absent = 1; }\nexport const n = req(["./d", "json"].join(".")).n + absent;',
      );
      write("tokens14.ts", tokensWith('import { n } from "./sub/m14.ts";', "n"));
      const r = await run("tokens14.ts");
      expect(r.problems).toEqual([]);
      const seen = r.observe?.();
      expect(seen?.reads).toContain(fs.realpathSync(path.join(root, "sub", "d.json")));
      expect(seen?.probes).toContainEqual(["realpath", path.join(root, "sub", "node_modules", "absent-q")]);
      expect(seen?.probes).toContainEqual(["realpath", path.join(root, "node_modules", "absent-q")]);
      expect(seen?.probes).toContainEqual(["process", "cwd"]);
    },
  );

  it(
    "records a relative import's candidates before the file it loaded, as absent",
    { timeout: fixedTime(30000) },
    async () => {
      write("h18.ts", "export const n = 5;");
      write("tokens18.ts", tokensWith('import { n } from "./h18";', "n"));
      const seen = (await run("tokens18.ts")).observe?.();
      expect(seen?.probes).toContainEqual(["stat", path.join(root, "h18")]);
      expect(seen?.probes).toContainEqual(["stat", path.join(root, "h18.tsx")]);
      expect(seen?.probes).not.toContainEqual(["stat", path.join(root, "h18.ts")]);
    },
  );

  it(
    "refuses a computed import() of a code file and each route to Node's own loader with E1050",
    { timeout: fixedTime(30000) },
    async () => {
      write("c15.cjs", "module.exports = 1;");
      const cases: readonly (readonly [string, RegExp])[] = [
        [
          `const n = (await import([${JSON.stringify(path.join(root, "c15"))}, "cjs"].join("."))).default;`,
          /^E1050 a require or import\(\) of ".*c15\.cjs", a code file/,
        ],
        ['import m from "node:module";\nconst n = m._load("./c15.cjs");', /^E1050 node:module\._load at build time/],
        [
          'import { createRequire } from "node:module";\nconst n = createRequire(import.meta.url)("module")._load("./c15.cjs");',
          /^E1050 node:module\._load at build time/,
        ],
        ["const n = process.mainModule.filename;", /^E1050 process\.mainModule at build time/],
        ['const n = import.meta.resolve("./c15.cjs");', /^E1050 import\.meta\.resolve at build time/],
        ['const n = Function("return 1")();', /^E1050 Function at build time/],
      ];
      for (const [i, [head, refused]] of cases.entries()) {
        write(`tokens15${i}.ts`, tokensWith(head, "n"));
        // Each refusal is placed at the case's own file (k.evaluator Placing), then names what it refused.
        const placed = new RegExp(`^E1050 tokens15${i}\\.ts:\\d+:\\d+ ${refused.source.slice("^E1050 ".length)}`);
        expect((await run(`tokens15${i}.ts`)).problems.join("\n")).toMatch(placed);
      }
    },
  );
});
