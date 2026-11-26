// Seed 1337 (no generated input: fixed fixtures). k.library-pack Own folder: `keel check` in a library's own folder
// imports the library's own `./tools`, as an app whose manifest lists the library imports it, so its formats hold over
// its own files and its rules do not (they judge the apps that list it); a format literal its own format refuses is still E1108; a library with no `./tools`
// registers nothing, so the same literal is E1108 not registered; a declared `./tools` that does not import is E1159 at
// `package.json`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { type Tree, cleanup, diags, keel, materialize } from "../conformance/compat-support.ts";
import { library, project, toolsRule } from "../conformance/library-support.ts";

const SLOW = 120_000;
const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});

const NAME = "@keel/std-ownfix";
const MODULE =
  "import { module } from '@keel/compiler'\nexport default module({ id: 'ownfix', deps: [], capabilities: [], public: { exports: ['A', 'B', 'Code'] } })\n";
const CODE = `import { s } from "@keel/schema";

/** Fixture format: text beginning with c. */
export const Code = s.format("ownfix.Code", s.string(), {
  check: (v) => v.startsWith("c"),
  gen: { from: s.int({ min: 0, max: 9 }), map: (n) => \`c\${n}\` },
});
export type Code = s.infer<typeof Code>;

s.register("ownfix.Code", Code);
`;
const literal = (name: string, text: string): string =>
  `import { formatLiteral } from "@keel/schema";\nimport { Code } from "./Code.schema.ts";\n\n/** Fixture value. */\nexport const ${name}: Code = formatLiteral(Code, "${text}");\n`;

/** The own folder of `@keel/std-ownfix`: `A` holds a literal its format takes, `B` one it refuses. */
function own(tools: string | null, toolsFile = 'import "../Code.schema.ts";\n'): string {
  const exports: Record<string, unknown> = { ".": { keel: "./src/index.ts", default: "./src/index.ts" } };
  if (tools !== null) exports["./tools"] = tools;
  const tree: Tree = {
    "package.json": `${JSON.stringify({ name: NAME, version: "1.0.0", type: "module", keel: "library", exports, peerDependencies: { "@keel/compiler": "*", "@keel/schema": "*" } }, null, 2)}\n`,
    "module.ts": MODULE,
    "src/Code.schema.ts": CODE,
    "src/A.ts": literal("A", "cat"),
    "src/B.ts": literal("B", "dog"),
    "src/index.ts":
      'export { A } from "./A.ts";\nexport { B } from "./B.ts";\nexport { Code } from "./Code.schema.ts";\n',
    "src/tools/index.ts": toolsFile,
  };
  const dir = materialize(tree);
  made.push(dir);
  return dir;
}

test(
  "the library's own ./tools registers its format: the literal it takes is clean, the one it refuses is E1108",
  () => {
    const found = diags(keel(own("./src/tools/index.ts"), ["check"]), "E1108");
    expect(found.map((d) => [d.path, d.message])).toEqual([
      ["src/B.ts", "formatLiteral text does not parse as ownfix.Code (format)"],
    ]);
  },
  SLOW,
);

test(
  "with no ./tools nothing registers: both literals are E1108, the format not registered",
  () => {
    const found = diags(keel(own(null), ["check"]), "E1108");
    expect(found.map((d) => [d.path, d.message])).toEqual([
      ["src/A.ts", "formatLiteral format ownfix.Code is not one registered format"],
      ["src/B.ts", "formatLiteral format ownfix.Code is not one registered format"],
    ]);
  },
  SLOW,
);

const RULE = `import "../Code.schema.ts";\nimport { defineRule } from "@keel/check";\ndefineRule({\n  code: "E2999",\n  message: "library rule ran",\n  see: "k.library",\n  explain: "Fixture rule a library's ./tools export registers.",\n  check: ({ file }) => (file.path.endsWith("/A.ts") ? [{ path: file.path, line: 1, col: 1 }] : []),\n});\n`;

test(
  "a rule the own ./tools registers does not judge the library's own files, however they import it",
  () => {
    const dir = own("./src/tools/index.ts", RULE);
    mkdirSync(join(dir, "test"), { recursive: true });
    writeFileSync(
      join(dir, "test", "A.ts"),
      'import { A } from "@keel/std-ownfix";\nimport { B } from "../src/B.ts";\nexport const both = [A, B];\n',
    );
    expect(diags(keel(dir, ["check"]), "E2999")).toEqual([]);
  },
  SLOW,
);

test(
  "an app listing the library is judged by the rule its ./tools registers",
  () => {
    const app = project({
      libraries: [
        library({
          name: NAME,
          id: "ownfix",
          exports: { "./tools": "./tools.js" },
          files: { "tools.js": toolsRule("E2999") },
        }),
      ],
      deps: [NAME],
    });
    const dir = materialize(app);
    made.push(dir);
    expect(diags(keel(dir, ["check"]), "E2999").length).toBeGreaterThan(0);
  },
  SLOW,
);

test(
  "a declared ./tools that does not import is one E1159 at package.json naming it",
  () => {
    const found = diags(keel(own("./dist/tools.js"), ["check"]), "E1159");
    expect(found.map((d) => [d.path, d.message])).toEqual([
      ["package.json", `${NAME} ./tools ./dist/tools.js does not import; build it`],
    ]);
  },
  SLOW,
);
