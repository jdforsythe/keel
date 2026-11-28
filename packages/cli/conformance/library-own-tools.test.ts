// Spec: k.library-pack, clause "In the own folder of `@keel/std-ownfix` (`id: 'ownfix'`), its `./tools` importing `src/Code.schema.ts`, which registers `s.format('ownfix.Code', s.string(), { check: (v) => v.startsWith('c'), gen })`, by `s.register('ownfix.Code', Code)`, `keel check` reports one E1108 for `formatLiteral(Code, 'dog')` in `src/B.ts` (`does not parse as ownfix.Code (format)`) and none for `formatLiteral(Code, 'cat')` in `src/A.ts`; with no `./tools`, each is E1108 `is not one registered format`; a rule `E2999` its `./tools` registers reports nothing there, in a file importing `@keel/std-ownfix` or `../src/A.ts`, and reports in an app listing it; `\"./tools\": \"./dist/tools.js\"`, no such file, is one E1159 at `package.json`."
// Seed: 1337 (no generated input). Binary runs: 6 `keel check` runs (with `./tools`, without, with a rule, with a rule and importing files, with a missing target, an app listing the library), each run once and shared by its cases.
// ASSUMPTIONS (spec silent): `./tools` is `"./tools": "./tools.ts"`, a root file that imports `./src/Code.schema.ts` (Node strips the types); `gen` is `{ from: s.string(), map: (v) => `c${v}` }`;
// a diagnostic's `path` is package-relative in an own folder ("each diagnostic at the folder's own path"); E1159 is judged by its code, path `package.json` and the message naming `./tools` and its target
// (`<name> ./tools <target> does not import; build it`, k.library-pack Package), and its line is the line of the `"./tools"` key when `package.json` is written with `JSON.stringify(value, null, 2)`.
// The app listing it gives the library the entry k.entries Shape requires of a listed library, `"./tools": { "keel": "./src/tools.ts", "default": "./tools.js" }` (keel first, a file under `src/`; k.library-pack Package), both files registering `E2999`; the own folder's runs keep the clause's plain-string entries.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SLOW,
  cleanup,
  diags,
  keel,
  library,
  manifestOf,
  materialize,
  project,
  toolsRule,
  type Tree,
} from "./library-support.ts";

const NAME = "@keel/std-ownfix";
const CODE_SCHEMA =
  "import { s } from '@keel/schema'\nexport const Code = s.format('ownfix.Code', s.string(), { check: (v) => v.startsWith('c'), gen: { from: s.string(), map: (v) => `c${v}` } })\ns.register('ownfix.Code', Code)\n";
const A_SRC =
  "import { formatLiteral } from '@keel/schema'\nimport { Code } from './Code.schema.ts'\nexport const a = formatLiteral(Code, 'cat')\n";
const B_SRC =
  "import { formatLiteral } from '@keel/schema'\nimport { Code } from './Code.schema.ts'\nexport const b = formatLiteral(Code, 'dog')\n";
const TOOLS = "import './src/Code.schema.ts'\n";

type Shape = { readonly tools: string | null; readonly target?: string; readonly extra?: Tree };
function folder({ tools, target = "./tools.ts", extra = {} }: Shape): { tree: Tree; json: string } {
  const json = JSON.stringify(
    {
      name: NAME,
      version: "1.0.0",
      type: "module",
      keel: "library",
      exports: {
        ".": { keel: "./src/index.ts", default: "./index.js" },
        ...(tools === null ? {} : { "./tools": target }),
      },
    },
    null,
    2,
  );
  const tree: Tree = {
    "package.json": json,
    "module.ts": manifestOf("ownfix", [], []),
    "index.js": "export {}\n",
    "src/index.ts": "export {}\n",
    "src/Code.schema.ts": CODE_SCHEMA,
    "src/A.ts": A_SRC,
    "src/B.ts": B_SRC,
    ...extra,
    ...(tools === null || target !== "./tools.ts" ? {} : { "tools.ts": tools }),
  };
  return { tree, json };
}

const made: string[] = [];
const run = (s: Shape): { json: string; records: ReturnType<typeof keel>["records"] } => {
  const { tree, json } = folder(s);
  const dir = materialize(tree);
  made.push(dir);
  return { json, records: keel(dir, ["check"]).records };
};
const runApp = (): ReturnType<typeof run> => {
  const dir = materialize(
    project({
      deps: [NAME],
      page: false,
      libraries: [
        library({
          name: NAME,
          id: "ownfix",
          exports: { "./tools": { keel: "./src/tools.ts", default: "./tools.js" } },
          files: { "tools.js": toolsRule("E2999"), "src/tools.ts": toolsRule("E2999") },
        }),
      ],
    }),
  );
  made.push(dir);
  return { json: "", records: keel(dir, ["check"]).records };
};
type Runs = Record<"withTools" | "noTools" | "rule" | "importing" | "app" | "missing", ReturnType<typeof run>>;
let runs: Runs | undefined;
beforeAll(() => {
  runs = {
    withTools: run({ tools: TOOLS }),
    noTools: run({ tools: null }),
    rule: run({ tools: `${TOOLS}${toolsRule("E2999")}` }),
    importing: run({
      tools: `${TOOLS}${toolsRule("E2999")}`,
      extra: {
        "src/ByName.ts": `import "${NAME}"\nexport const byName = 1\n`,
        "test/ByPath.test.ts": "import { a } from ../src/A.ts\nexport const byPath = a\n",
      },
    }),
    app: runApp(),
    missing: run({ tools: TOOLS, target: "./dist/tools.js" }),
  };
}, SLOW);
afterAll(() => {
  for (const d of made) cleanup(d);
});
const get = (k: keyof Runs): ReturnType<typeof run> => {
  if (runs === undefined) throw new Error("runs not made");
  return runs[k];
};
const paths = (k: keyof Runs, code: string): unknown[] =>
  diags({ status: null, records: get(k).records }, code).map((r) => r.path);
const msgs = (k: keyof Runs, code: string, path: string): string[] =>
  diags({ status: null, records: get(k).records }, code).flatMap((r) =>
    r.path === path && typeof r.message === "string" ? [r.message] : [],
  );

describe("an own folder imports its own ./tools", () => {
  it("with `./tools` registering `ownfix.Code`, `keel check` reports one E1108, at `src/B.ts`", () => {
    expect(paths("withTools", "E1108")).toEqual(["src/B.ts"]);
  });

  it("the E1108 for `formatLiteral(Code, 'dog')` in `src/B.ts` reads `does not parse as ownfix.Code (format)`", () => {
    const m = msgs("withTools", "E1108", "src/B.ts");
    expect(m.length).toBe(1);
    expect(m[0]).toContain("does not parse as ownfix.Code (format)");
  });

  it("`formatLiteral(Code, 'cat')` in `src/A.ts` is no E1108", () => {
    expect(paths("withTools", "E1108")).not.toContain("src/A.ts");
  });

  it("with no `./tools`, `formatLiteral(Code, 'cat')` in `src/A.ts` is E1108 `is not one registered format`", () => {
    const m = msgs("noTools", "E1108", "src/A.ts");
    expect(m.length).toBe(1);
    expect(m[0]).toContain("is not one registered format");
  });

  it("with no `./tools`, `formatLiteral(Code, 'dog')` in `src/B.ts` is E1108 `is not one registered format`", () => {
    const m = msgs("noTools", "E1108", "src/B.ts");
    expect(m.length).toBe(1);
    expect(m[0]).toContain("is not one registered format");
  });

  it("with no `./tools`, each of the two is the only E1108 in the folder", () => {
    expect(paths("noTools", "E1108").sort()).toEqual(["src/A.ts", "src/B.ts"]);
  });

  it("a rule `E2999` its `./tools` registers reports nothing there", () => {
    expect(paths("rule", "E2999")).toEqual([]);
  });

  it("a rule `E2999` its `./tools` registers reports nothing in a file importing `@keel/std-ownfix`", () => {
    expect(paths("importing", "E2999")).not.toContain("src/ByName.ts");
    expect(paths("importing", "E2999")).toEqual([]);
  });

  it("a rule `E2999` its `./tools` registers reports nothing in a file importing `../src/A.ts`", () => {
    expect(paths("importing", "E2999")).not.toContain("test/ByPath.test.ts");
  });

  it("a rule `E2999` its `./tools` registers reports in an app listing it", () => {
    expect(paths("app", "E2999")).toContain("modules/shop/module.ts");
  });

  it("with no rule registered, no E2999 reports", () => {
    expect(paths("withTools", "E2999")).toEqual([]);
  });

  it('`"./tools": "./dist/tools.js"`, no such file, is one E1159, at `package.json`', () => {
    expect(paths("missing", "E1159")).toEqual(["package.json"]);
  });

  it('the E1159 for `./dist/tools.js` names `./tools` and its target, and is at the `"./tools"` key\'s line', () => {
    const { json, records } = get("missing");
    const d = diags({ status: null, records }, "E1159");
    expect(d.length).toBe(1);
    expect(String(d[0]?.message)).toContain(`${NAME} ./tools ./dist/tools.js does not import`);
    const line = json.split("\n").findIndex((l) => l.includes('"./tools"')) + 1;
    expect(d[0]?.line).toBe(line);
  });

  it("a `./tools` that imports raises no E1159", () => {
    expect(paths("withTools", "E1159")).toEqual([]);
  });
});
