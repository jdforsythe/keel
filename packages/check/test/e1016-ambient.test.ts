// k.boundary Ambient types (E1016): the directive scan against TypeScript's own parse, and the declaration edges.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import fc from "fast-check";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { check } from "../src/index.ts";
import { referenceDirectives } from "../src/internal/referenceDirectives.ts";

const HERE = import.meta.dirname;
const COMPILER = realpathSync(join(HERE, "..", "..", "compiler"));
const NODE_TYPES = realpathSync(join(HERE, "..", "node_modules", "@types", "node"));
const VITE = dirname(createRequire(join(COMPILER, "package.json")).resolve("vite/package.json"));

let dir = "";
const put = (path: string, source: string): void => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), source);
};
const link = (path: string, target: string): void => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  symlinkSync(target, join(dir, path));
};
beforeAll(() => {
  dir = mkdtempSync(join(realpathSync(tmpdir()), "keel-e1016-"));
  link("node_modules/@keel/compiler", COMPILER);
  link("node_modules/@types/node", NODE_TYPES);
  link("node_modules/vite", VITE);
  const pkg = (name: string, index: string): void => {
    put(`node_modules/${name}/package.json`, JSON.stringify({ name, version: "1.0.0", types: "index.d.ts" }));
    put(`node_modules/${name}/index.d.ts`, index);
  };
  pkg("deep-aug", "export {}\ndeclare global { interface ImportMetaEnv { DEEP: string } }\n");
  pkg("wrap-aug", "export * from 'deep-aug'\nexport declare const w: number\n");
  pkg("ref-aug", '/// <reference types="vite/client" />\nexport declare const r: number\n');
  pkg(
    "nolib-aug",
    '/// <reference no-default-lib="true" />\nexport {}\ndeclare global { interface ImportMeta { n: 1 } }\n',
  );
  pkg("plain", "export declare const p: number\n");
});
afterAll(() => {
  if (dir !== "") rmSync(dir, { recursive: true, force: true });
});

const f = (path: string, source: string) => ({ path, source });
const e1016 = (files: { path: string; source: string }[], types = true) =>
  check(files, { root: dir, ...(types ? {} : { types: false }) }).diagnostics.filter((d) => d.code === "E1016");
const at = (files: { path: string; source: string }[]) => e1016(files).map((d) => [d.path, d.line, d.col]);

describe("the directive scan reads what TypeScript reads", () => {
  const line = fc.constantFrom(
    '/// <reference types="vite/client" />',
    "/// <reference path='./g.d.ts' />",
    '///<reference lib="dom"/>',
    '/// <REFERENCE lib="dom" />',
    '/// <reference no-default-lib="true" />',
    '/// <reference foo="x" />',
    "/// <reference />",
    '//// <reference types="x" />',
    "// a comment",
    "/* a block */",
    '/* /// <reference types="x" /> */',
    "",
    "export const a = 1",
    'const s = "/// <reference types=\\"x\\" />"',
  );
  test("property: each directive the scan finds is one TypeScript honours, and the other way round", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.array(line, { maxLength: 6 }), (shebang, lines) => {
        const text = `${shebang ? "#!/usr/bin/env node\n" : ""}${lines.join("\n")}\n`;
        const sf = ts.createSourceFile("x.ts", text, ts.ScriptTarget.ES2022, true);
        const honoured =
          sf.referencedFiles.length +
          sf.typeReferenceDirectives.length +
          sf.libReferenceDirectives.length +
          (sf.hasNoDefaultLib ? 1 : 0);
        // TypeScript keeps one `hasNoDefaultLib` however many directives set it.
        const found = referenceDirectives(text).map(({ start, end }) => text.slice(start, end));
        const noLib = found.filter((c) => /no-default-lib/i.test(c)).length;
        expect(found.length - Math.max(0, noLib - 1)).toBe(honoured);
        for (const c of found) expect(c.startsWith("//")).toBe(true);
      }),
      { seed: 1337, numRuns: 300 },
    );
  });

  test("a directive after code, in a block comment or in a string is none; one after a shebang or a comment is found", () => {
    expect(at([f("modules/a/x.ts", 'export {}\n/// <reference types="vite/client" />\n')])).toEqual([]);
    expect(at([f("modules/a/x.ts", '/* /// <reference lib="dom" /> */\nexport {}\n')])).toEqual([]);
    expect(at([f("modules/a/x.ts", '#!/usr/bin/env node\n/// <reference lib="dom" />\nexport {}\n')])).toEqual([
      ["modules/a/x.ts", 2, 1],
    ]);
    expect(at([f("modules/a/x.ts", '/* c */ /// <reference lib="dom" />\nexport {}\n')])).toEqual([
      ["modules/a/x.ts", 1, 9],
    ]);
  });

  test("two directives are two findings; a declaration file's directive is one; it holds with the type pass off", () => {
    expect(
      at([f("modules/a/x.ts", '/// <reference lib="dom" />\n/// <reference types="node" />\nexport {}\n')]),
    ).toEqual([
      ["modules/a/x.ts", 1, 1],
      ["modules/a/x.ts", 2, 1],
    ]);
    expect(at([f("src/vite-env.d.ts", '/// <reference types="vite/client" />\n')])).toEqual([
      ["src/vite-env.d.ts", 1, 1],
    ]);
    expect(e1016([f("modules/a/x.ts", '/// <reference lib="dom" />\nexport {}\n')], false)).toHaveLength(1);
  });
});

describe("the declaration", () => {
  test("a global `interface ImportMeta` in a script file is one E1016 at `interface`, past `declare`", () => {
    expect(at([f("modules/a/g.d.ts", "/** doc */\ndeclare interface ImportMeta { x: string }\n")])).toEqual([
      ["modules/a/g.d.ts", 2, 9],
    ]);
  });

  test("a project file importing a project file that imports vite/client: the finding sits at the inner import", () => {
    const ds = e1016([
      f("modules/a/A.ts", "import './B.ts'\nexport const a = 1\n"),
      f("modules/a/B.ts", "export const b = 1\nimport 'vite/client'\n"),
    ]);
    expect(ds.map((d) => [d.path, d.line, d.message])).toEqual([
      ["modules/a/B.ts", 2, "vite/types/importMeta.d.ts declares import.meta types; they are Keel's and Node's only"],
    ]);
  });

  test("a package that loads a declaring package through another, or through a reference, is found at the project import", () => {
    expect(at([f("modules/a/A.ts", "export const a = 1\nimport { w } from 'wrap-aug'\nexport const x = w\n")])).toEqual(
      [["modules/a/A.ts", 2, 1]],
    );
    const ref = e1016([f("modules/a/A.ts", "import { r } from 'ref-aug'\nexport const x = r\n")]);
    expect(ref.map((d) => [d.line, d.message.startsWith("vite/")])).toEqual([[1, true]]);
  });

  test("a package's `no-default-lib` does not make it TypeScript's lib", () => {
    const ds = e1016([f("modules/a/A.ts", "import 'nolib-aug'\nexport const a = 1\n")]);
    expect(ds.map((d) => d.message)).toEqual([
      "nolib-aug/index.d.ts declares import.meta types; they are Keel's and Node's only",
    ]);
  });

  test("a package that declares neither and Keel's own types are none", () => {
    expect(
      at([f("modules/a/A.ts", "import { p } from 'plain'\nexport const a = p + import.meta.env.MODE.length\n")]),
    ).toEqual([]);
  });

  test("the type cache gives the same findings", () => {
    const cache = mkdtempSync(join(realpathSync(tmpdir()), "keel-e1016-cache-"));
    try {
      const files = [f("modules/a/A.ts", "import 'wrap-aug'\nexport const a = 1\n")];
      const run = () =>
        check(files, { root: dir, typeCache: cache })
          .diagnostics.filter((d) => d.code === "E1016")
          .map((d) => [d.path, d.line, d.message]);
      const first = run();
      expect(first).toHaveLength(1);
      expect(run()).toEqual(first);
    } finally {
      rmSync(cache, { recursive: true, force: true });
    }
  });
});
