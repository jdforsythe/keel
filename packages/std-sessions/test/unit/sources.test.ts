// How E2005 and E2009 follow imports without running code: `sourcesOf` lists the module specifiers a file imports or
// re-exports, `reachesSource` follows a specifier through project files to a target, and `servedOffNode` reports the
// declarations that lead there when a deployable that is not `node` serves the module.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { parseTs } from "../../src/internal/parseTs.ts";
import { reachesSource } from "../../src/internal/reachesSource.ts";
import { servedOffNode } from "../../src/internal/servedOffNode.ts";
import { sourcesOf } from "../../src/internal/sourcesOf.ts";

const program = (source: string, path = "modules/cart/routes.ts") => {
  const ast = parseTs(path, source);
  if (ast === undefined) throw new Error(`the fixture parses: ${source}`);
  return ast;
};
/** The specifiers of `source`, in the order `sourcesOf` gives them. */
const specifiers = (source: string): string[] => sourcesOf(program(source)).map((s) => s.value);

describe("sourcesOf: declarations", () => {
  test("imports, re-exports and export-all are sources, in order; a local export is not", () => {
    const source = [
      'import a from "a";',
      'import { b } from "b";',
      'import * as c from "c";',
      'import "d";',
      'export * from "e";',
      'export * as f from "f";',
      'export { g } from "g";',
      "export const local = 1;",
      "export { local as other };",
    ].join("\n");
    expect(specifiers(source)).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
  });

  test("type-only declarations are not sources; a value import with an inline type name is", () => {
    const source = [
      'import type T from "type-import";',
      'import type { U } from "type-named";',
      'export type { V } from "type-export";',
      'export type * from "type-all";',
      'import { type W, x } from "mixed";',
      'export { type Y, z } from "mixed-export";',
    ].join("\n");
    expect(specifiers(source)).toEqual(["mixed", "mixed-export"]);
  });

  test("each source carries the offset of its string", () => {
    const source = 'import a from "a";\nexport * from "bb";\nconst c = require("ccc");\nawait import("dddd");\n';
    for (const s of sourcesOf(program(source)))
      expect(source.slice(s.start, s.start + s.value.length + 2)).toBe(`"${s.value}"`);
    expect(specifiers(source)).toEqual(["a", "bb", "ccc", "dddd"]);
  });

  test("import x = require('x') is a source; its type-only form and an import of a namespace are not", () => {
    const source = [
      'import eq = require("eq");',
      'import type teq = require("type-eq");',
      "import alias = Some.Name;",
    ].join("\n");
    expect(specifiers(source)).toEqual(["eq"]);
  });
});

describe("sourcesOf: import() and require()", () => {
  test("a string literal, a template with no substitution, a + of those, or a const bound to one", () => {
    const source = [
      'const bound = "bound";',
      'const joined = "join" + `ed`;',
      'import("literal");',
      "import(`template`);",
      'import("con" + "cat" + `enated`);',
      'import(("paren"));',
      "import(bound);",
      "import(joined);",
      'require("required");',
      "require(bound);",
    ].join("\n");
    expect(specifiers(source)).toEqual([
      "literal",
      "template",
      "concatenated",
      "paren",
      "bound",
      "joined",
      "required",
      "bound",
    ]);
  });

  test("anything that is no fixed string is not a source", () => {
    const source = [
      "let unset;",
      "const { length } = holder;",
      "const n = 5;",
      "import(unknown);",
      "import(`with-${n}`);",
      "import(5);",
      "import(n);",
      'import("a" + 5);',
      'import(5 + "a");',
      'import("a" + unknown);',
      'import(unknown + "a");',
      'import("a" - "b");',
      "import(cond ? 'x' : 'y');",
      "require();",
      "require(...args);",
      "require(5);",
      "require(null);",
      "require(unset);",
    ].join("\n");
    expect(specifiers(source)).toEqual([]);
  });

  test("require may be parenthesized, module.require, createRequire(...), or a name bound to one of them", () => {
    const source = [
      '(require)("paren");',
      'module.require("module");',
      '(module).require("paren-module");',
      'createRequire(import.meta.url)("created");',
      '(createRequire)(import.meta.url)("paren-created");',
      "const req = createRequire(import.meta.url);",
      'req("bound-created");',
      "const again = require;",
      'again("bound-require");',
      "const third = again;",
      'third("bound-twice");',
      "const viaModule = module.require;",
      'viaModule("bound-module");',
    ].join("\n");
    expect(specifiers(source)).toEqual([
      "paren",
      "module",
      "paren-module",
      "created",
      "paren-created",
      "bound-created",
      "bound-require",
      "bound-twice",
      "bound-module",
    ]);
  });

  test("a call that only looks like require is not a source", () => {
    const source = [
      'other.require("no-1");',
      'module["require"]("no-2");',
      'module.resolve("no-3");',
      'notRequire("no-4");',
      'make(import.meta.url)("no-5");',
      'ns.createRequire(import.meta.url)("no-6");',
      'module.require.call(null, "no-7");',
      'other.module.require("no-8");',
      "requireish`no-9`;",
      "const plain = helper;",
      'plain("no-10");',
      'const made = make("no-11");',
      'made("no-12");',
      'new require("no-13");',
    ].join("\n");
    expect(specifiers(source)).toEqual([]);
  });

  test("a require inside a function, a destructuring or an export is still found", () => {
    const source = [
      'function f() { return require("in-function"); }',
      'const { a } = require("destructured");',
      'export const b = require("exported");',
      'const lazy = () => import("in-arrow");',
    ].join("\n");
    expect(specifiers(source)).toEqual(["in-function", "destructured", "exported", "in-arrow"]);
  });
});

describe("reachesSource", () => {
  const TARGET = "@keel/std-sessions/routes";
  const file = (path: string, ...imports: string[]) => ({
    path,
    source: imports.map((i) => `export * from "${i}";`).join("\n"),
  });
  const reaches = (project: { path: string; source: string }[], spec: string, from = "modules/cart/routes.ts") =>
    reachesSource(project, from, spec, TARGET);

  test("the target itself is reached; another package, or a relative path to no file, is not", () => {
    expect(reaches([], TARGET)).toBe(true);
    expect(reaches([], "@keel/std-sessions")).toBe(false);
    expect(reaches([], "@keel/std-sessions/routes/x")).toBe(false);
    expect(reaches([], "./missing")).toBe(false);
  });

  test("a relative specifier is followed to a project file that imports the target", () => {
    expect(reaches([file("modules/cart/a.ts", TARGET)], "./a")).toBe(true);
    expect(reaches([file("modules/cart/a.ts", TARGET)], "./a.ts")).toBe(true);
    expect(reaches([file("modules/cart/a.tsx", TARGET)], "./a")).toBe(true);
    expect(reaches([file("modules/cart/dir/index.ts", TARGET)], "./dir")).toBe(true);
    expect(reaches([file("modules/cart/dir/index.tsx", TARGET)], "./dir")).toBe(true);
    expect(reaches([file("modules/shared/a.ts", TARGET)], "../shared/a")).toBe(true);
    expect(reaches([file("modules/cart/a.ts", TARGET)], "./x/../a")).toBe(true);
    expect(reaches([file("modules/cart/a.ts", "./other")], "./a")).toBe(false);
    expect(reaches([file("modules/other/a.ts", TARGET)], "./a")).toBe(false);
  });

  test("a .js, .jsx or .mjs specifier names its TypeScript source", () => {
    expect(reaches([file("modules/cart/a.ts", TARGET)], "./a.js")).toBe(true);
    expect(reaches([file("modules/cart/a.tsx", TARGET)], "./a.js")).toBe(true);
    expect(reaches([file("modules/cart/a.tsx", TARGET)], "./a.jsx")).toBe(true);
    expect(reaches([file("modules/cart/a.mts", TARGET)], "./a.mjs")).toBe(true);
    expect(reaches([file("modules/cart/a.ts", TARGET)], "./a.jsx")).toBe(false);
    expect(reaches([file("modules/cart/a.ts", TARGET)], "./a.mjs")).toBe(false);
    expect(reaches([file("modules/cart/a.mts", TARGET)], "./a.js")).toBe(false);
    expect(reaches([file("modules/cart/a.ts", TARGET)], "./a.cjs")).toBe(false);
    expect(reaches([file("modules/cart/a.js", TARGET)], "./a.js")).toBe(true);
  });

  test("a bare specifier is never looked up as a file beside the importer", () => {
    const project = [file("modules/cart/pkg.ts", TARGET), file("modules/cart/pkg/index.ts", TARGET)];
    expect(reaches(project, "pkg")).toBe(false);
    expect(reaches(project, "./pkg")).toBe(true);
  });

  test("the target is reached through further files; a cycle that never gets there ends", () => {
    const chain = [
      file("modules/cart/a.ts", "./b"),
      file("modules/cart/b.ts", "./unrelated", "./c.js"),
      file("modules/cart/c.ts", TARGET),
      file("modules/cart/unrelated.ts", "@keel/schema"),
    ];
    expect(reaches(chain, "./a")).toBe(true);
    expect(reaches(chain, "./unrelated")).toBe(false);
    const cycle = [
      file("modules/cart/a.ts", "./b"),
      file("modules/cart/b.ts", "./a", "./c"),
      file("modules/cart/c.ts", "./a"),
    ];
    expect(reaches(cycle, "./a")).toBe(false);
    const through = [...cycle.slice(0, 2), file("modules/cart/c.ts", "./a", TARGET)];
    expect(reaches(through, "./a")).toBe(true);
  });

  test("a file that does not parse leads nowhere; a file already seen is not read again", () => {
    expect(reaches([{ path: "modules/cart/a.ts", source: `export * from "${TARGET}"; export const = ;` }], "./a")).toBe(
      false,
    );
    const seen = new Set(["modules/cart/a.ts"]);
    expect(reachesSource([file("modules/cart/a.ts", TARGET)], "modules/cart/routes.ts", "./a", TARGET, seen)).toBe(
      false,
    );
    const fresh = new Set<string>();
    expect(reachesSource([file("modules/cart/a.ts", TARGET)], "modules/cart/routes.ts", "./a", TARGET, fresh)).toBe(
      true,
    );
    expect([...fresh]).toEqual(["modules/cart/a.ts"]);
  });

  test("property: a chain of any length reaches the target, and does not without its last link", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), (length) => {
        const links = Array.from({ length }, (_, i) =>
          file(`modules/cart/f${i}.ts`, i === length - 1 ? TARGET : `./f${i + 1}`),
        );
        expect(reaches(links, "./f0")).toBe(true);
        expect(reaches(links.slice(0, -1), "./f0")).toBe(false);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});

describe("servedOffNode", () => {
  const TARGET = "@keel/std-sessions/routes";
  const topology = (body: string, path = "topology.ts") => ({
    path,
    source: `import { topology } from "@keel/compiler";\nexport default topology(${body});\n`,
  });
  const found = (
    source: string,
    project: { path: string; source: string }[],
    path = "modules/cart/routes.ts",
    files = ["routes.ts"],
  ) => {
    const file = { path, source };
    return servedOffNode({ file, ast: program(source, path), project: [file, ...project] }, files, TARGET);
  };
  const direct = `import { routes } from "${TARGET}";\nexport { routes };\n`;
  const staticWeb = topology('{ web: { modules: ["cart"], adapter: "static" } }');

  test("one finding per declaration that leads to the target, at its specifier, naming the deployable and adapter", () => {
    const source = `import { helper } from "./helper.ts";\nimport { routes } from "${TARGET}";\nexport * from "./again.ts";\nexport { x } from "./unrelated.ts";\n`;
    const project = [
      { path: "modules/cart/helper.ts", source: `export * from "${TARGET}";` },
      { path: "modules/cart/again.ts", source: 'export * from "./helper.ts";' },
      { path: "modules/cart/unrelated.ts", source: "export const x = 1;" },
      staticWeb,
    ];
    expect(found(source, project)).toEqual([
      { path: "modules/cart/routes.ts", line: 1, col: 24, data: { deployable: "web", adapter: "static" } },
      { path: "modules/cart/routes.ts", line: 2, col: 24, data: { deployable: "web", adapter: "static" } },
      { path: "modules/cart/routes.ts", line: 3, col: 15, data: { deployable: "web", adapter: "static" } },
    ]);
  });

  test("the first deployable that is not node and serves the module is the one named", () => {
    const project = [
      topology(
        '{ api: { modules: ["cart"], adapter: "node" }, other: { modules: ["orders"], adapter: "static" }, app: { modules: ["orders", "cart"], adapter: "client" }, web: { modules: ["cart"], adapter: "static" } }',
      ),
    ];
    expect(found(direct, project)).toEqual([
      { path: "modules/cart/routes.ts", line: 1, col: 24, data: { deployable: "app", adapter: "client" } },
    ]);
  });

  test("nothing when every deployable serving the module is node, or none serves it", () => {
    expect(found(direct, [topology('{ api: { modules: ["cart"], adapter: "node" } }')])).toEqual([]);
    expect(found(direct, [topology('{ web: { modules: ["orders"], adapter: "static" } }')])).toEqual([]);
    expect(found(direct, [topology("{}")])).toEqual([]);
  });

  test("nothing without the project's topology.ts, which lies beside its modules folder", () => {
    expect(found(direct, [])).toEqual([]);
    expect(found(direct, [{ ...staticWeb, path: "apps/shop/topology.ts" }])).toEqual([]);
    expect(found(direct, [{ ...staticWeb, path: "modules/topology.ts" }])).toEqual([]);
    const nested = "apps/shop/modules/cart/routes.ts";
    expect(found(direct, [{ ...staticWeb, path: "apps/shop/topology.ts" }], nested)).toEqual([
      { path: nested, line: 1, col: 24, data: { deployable: "web", adapter: "static" } },
    ]);
    expect(found(direct, [staticWeb], nested)).toEqual([]);
  });

  test("nothing for a file that is not one of the named module files, or that does not lead to the target", () => {
    expect(found(direct, [staticWeb], "modules/cart/other.ts")).toEqual([]);
    expect(found(direct, [staticWeb], "modules/cart/sub/routes.ts")).toEqual([]);
    expect(found(direct, [staticWeb], "src/routes.ts")).toEqual([]);
    expect(found('import { s } from "@keel/schema";\n', [staticWeb])).toEqual([]);
    expect(
      found(direct, [staticWeb], "modules/cart/runners.server.ts", ["routes.ts", "runners.server.ts"]),
    ).toHaveLength(1);
    expect(found(direct, [staticWeb], "modules/cart/routes.ts", [])).toEqual([]);
  });
});
