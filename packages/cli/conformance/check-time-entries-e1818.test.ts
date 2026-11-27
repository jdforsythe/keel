// Spec: k.check-time, clause "In a project with a `node` module `a`, `import { defineTokens } from '@keel/ui/tokens'` in route component `modules/a/A.tsx` is one E1818 at the specifier with message `@keel/ui/tokens is check and build time only; use token names or @keel/ui/brand`, and `import { contrast } from '@keel/ui/css'` in `lib/tone.ts`, which `A.tsx` imports, one with `@keel/ui/css`; there is none for those imports in `tokens.ts`, in `tokens.design.ts` that only `tokens.ts` imports, in `modules/a/A.test.tsx`, in `vite.config.ts` or in `modules/a/a.server.ts`, nor for `import type { Tokens } from '@keel/ui/tokens'` in `A.tsx`; when `A.tsx` also imports `tokens.ts`, there are two E1818, both at `A.tsx`'s specifier `'../../tokens.ts'`, with messages `tokens.ts imports @keel/ui/tokens, check and build time only` and `tokens.design.ts imports @keel/ui/tokens, check and build time only`, and none in either file; `keel build` with any E1818 exits 1 and writes no `dist/`."
// Spec: k.check-time, clause "In that project, with `test/seed.ts` and `theme.config.ts` each holding `import { defineTokens } from '@keel/ui/tokens'`, `lib/load.ts` importing `../test/seed.ts`, and `A.tsx` importing `../../lib/load.ts` and `../../theme.config.ts`, `keel check` reports two E1818 in `A.tsx`, at those two specifiers, with messages `test/seed.ts imports @keel/ui/tokens, check and build time only` and `theme.config.ts imports @keel/ui/tokens, check and build time only`, and none in `test/seed.ts`, `theme.config.ts` or `lib/load.ts`; `export { type Tokens } from '@keel/ui/tokens'` in `A.tsx` is none; without those two imports in `A.tsx` there is none."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until the build follows.
// The `keel check` half over the real binary; the `keel build` half is check-time-entries-build.test.ts, the library half packages/check/conformance/check-time-entries-library.test.ts.
// ASSUMPTIONS (spec names no fixture layout): the project is compat-support's `staticTree` (module `s`, route component `modules/s/Page.tsx`, `modules/s/home.server.ts`) with `adapter: 'node'`, standing for the clause's module `a`, `A.tsx`, `A.test.tsx` and `a.server.ts`; a second deployable `web` of adapter `client` lists module `c`, whose every file is a client entry. A diagnostic's position is the opening quote of the specifier, as E1013's, in a record `{ kind: "diag", code, path, line, col, message }`. A reached file's chain starts at the specifier of the client entry's own import of the chain's first file, so `A.tsx -> lib/load.ts -> test/seed.ts` is reported at `A.tsx`'s import of `lib/load.ts`. The clip of `<file>` is read as: drop leading segments one at a time, prefixing `.../`, until the whole message is at most 89 units.
// Not asserted (the sentence leaves it open): a reached file holding both entries or one import written twice; the report of a `*.server.*` file inside a `client` module, which is itself a client entry.
import { relative as relativePath } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Run, type Tree, cleanup, diags, keel, materialize } from "./compat-support.ts";
import { staticTree } from "./static-support.ts";

const SEED = 1337;
const T = fixedTime(300_000);
const TOKENS = "'@keel/ui/tokens'";
const CSS = "'@keel/ui/css'";
const msg = (entry: string): string => `${entry} is check and build time only; use token names or @keel/ui/brand`;
/** `<file> imports <entry>, check and build time only`, `<file>` clipped behind one `.../` until the message is at most 89 units. */
const reachMsg = (file: string, entry: string): string => {
  const segs = file.split("/");
  for (let k = 0; k < segs.length; k++) {
    const shown = k === 0 ? file : `.../${segs.slice(k).join("/")}`;
    const m = `${shown} imports ${entry}, check and build time only`;
    if (m.length <= 89 || k === segs.length - 1) return m;
  }
  return "";
};
const TOPOLOGY = `import { topology } from '@keel/server'\nexport default topology({ site: { modules: ['s'], adapter: 'node' }, web: { modules: ['c'], adapter: 'client' } })\n`;
const PAGE = "modules/s/Page.tsx";
const withPage = (head: string): string => `${head}${staticTree("none", undefined, "node")[PAGE] ?? ""}`;
const base = (): Tree => ({
  ...staticTree("none", TOPOLOGY, "node"),
  "modules/c/module.ts":
    "import { module } from '@keel/compiler'\nexport default module({ id: 'c', deps: [], capabilities: [], public: { exports: [] } })\n",
  "modules/c/view.ts": "export const view = 1\n",
});
const TOKENS_TS = "import { brandTokens } from '@keel/ui/brand'\nexport const tokens = brandTokens\n";
const dirs: string[] = [];
const make = (tree: Tree): string => {
  const d = materialize(tree);
  dirs.push(d);
  return d;
};
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const col = (line: string, quoted: string): number => line.indexOf(quoted) + 1;
const e1818 = (r: Run) => diags(r, "E1818");
const at = (r: Run, path: string) => e1818(r).filter((d) => d.path === path);
/** The 1-based line and the opening-quote column of `quoted` in `head`. */
const where = (head: string, quoted: string): { line: number; col: number } => {
  const lines = head.split("\n");
  const i = lines.findIndex((l) => l.includes(quoted));
  return { line: i + 1, col: col(lines[i] ?? "", quoted) };
};
const checkOf = (tree: Tree): Run => keel(make(tree), ["check"]);
const IMPORT_TOKENS = `import { defineTokens } from ${TOKENS}\nexport const t = defineTokens\n`;

describe("k.check-time #1: where the check-time entries may be imported", () => {
  const L_PAGE = `import { defineTokens } from ${TOKENS}\nimport type { Tokens } from ${TOKENS}\nimport { tone } from '../../lib/tone.ts'\n`;
  let r1: Run;
  beforeAll(() => {
    r1 = checkOf({
      ...base(),
      [PAGE]: withPage(L_PAGE),
      "lib/tone.ts": `import { contrast } from ${CSS}\nexport const tone = contrast\n`,
      "tokens.ts": `import { defineTokens } from ${TOKENS}\nimport { brandTokens } from '@keel/ui/brand'\nimport './tokens.design.ts'\nexport const tokens = defineTokens({ ...brandTokens })\n`,
      "tokens.design.ts": `import { contrast } from ${CSS}\nexport const d = contrast\n`,
      "modules/s/Page.test.tsx": IMPORT_TOKENS,
      "modules/s/Page.spec.tsx": `import { contrast } from ${CSS}\nexport const t = contrast\n`,
      "vite.config.ts": `import { defineTokens } from ${TOKENS}\nimport keel from '@keel/compiler/vite'\nimport { defineConfig } from 'vite'\nexport const t = defineTokens\nexport default defineConfig({ plugins: [keel()] })\n`,
      "tailwind.config.ts": `import { contrast } from ${CSS}\nexport default contrast\n`,
      "modules/s/note.server.ts": IMPORT_TOKENS,
    });
  }, T);

  it(
    "`import { defineTokens } from '@keel/ui/tokens'` in route component `modules/a/A.tsx` is one E1818 at the specifier with message `@keel/ui/tokens is check and build time only; use token names or @keel/ui/brand`",
    () => {
      const d = at(r1, PAGE).filter((x) => x.line === 1);
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject({
        message: msg("@keel/ui/tokens"),
        line: 1,
        col: col(L_PAGE.split("\n")[0] ?? "", TOKENS),
      });
    },
    T,
  );

  it(
    "and `import { contrast } from '@keel/ui/css'` in `lib/tone.ts`, which `A.tsx` imports, one with `@keel/ui/css`",
    () => {
      const d = at(r1, "lib/tone.ts");
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject({
        message: msg("@keel/ui/css"),
        line: 1,
        col: col(`import { contrast } from ${CSS}`, CSS),
      });
    },
    T,
  );

  it(
    "an E1818 has no fix",
    () => {
      for (const d of e1818(r1)) expect(d.fix).toBeUndefined();
    },
    T,
  );

  for (const [what, path] of [
    ["`tokens.ts`", "tokens.ts"],
    ["`tokens.design.ts` that only `tokens.ts` imports", "tokens.design.ts"],
    ["`modules/a/A.test.tsx`", "modules/s/Page.test.tsx"],
    ["a `*.spec.*` file", "modules/s/Page.spec.tsx"],
    ["`vite.config.ts`", "vite.config.ts"],
    ["another `*.config.*` file", "tailwind.config.ts"],
    ["`modules/a/a.server.ts`", "modules/s/note.server.ts"],
  ] as const) {
    it(
      `there is none for those imports in ${what}`,
      () => {
        expect(at(r1, path)).toEqual([]);
      },
      T,
    );
  }

  it(
    "nor for `import type { Tokens } from '@keel/ui/tokens'` in `A.tsx`: its E1818 are line 1's and line 3's `lib/tone.ts`'s own (none in `A.tsx`), so line 2 has none",
    () => {
      expect(at(r1, PAGE).map((d) => d.line)).toEqual([1]);
      expect(e1818(r1)).toHaveLength(2);
    },
    T,
  );

  describe("when `A.tsx` also imports `tokens.ts`", () => {
    const head = "import { tokens } from '../../tokens.ts'\n";
    let r: Run;
    beforeAll(() => {
      r = checkOf({
        ...base(),
        [PAGE]: withPage(head),
        "tokens.ts": `import { defineTokens } from ${TOKENS}\nimport { brandTokens } from '@keel/ui/brand'\nimport './tokens.design.ts'\nexport const tokens = defineTokens({ ...brandTokens })\n`,
        "tokens.design.ts": `import { defineTokens } from ${TOKENS}\nexport const d = defineTokens\n`,
      });
    }, T);

    it(
      "there are two E1818, both at `A.tsx`'s specifier `'../../tokens.ts'`, with messages `tokens.ts imports @keel/ui/tokens, check and build time only` and `tokens.design.ts imports @keel/ui/tokens, check and build time only`",
      () => {
        const d = at(r, PAGE);
        const pos = where(head, "'../../tokens.ts'");
        expect(d).toHaveLength(2);
        for (const x of d) expect(x).toMatchObject(pos);
        expect(d.map((x) => x.message).sort()).toEqual(
          [reachMsg("tokens.ts", "@keel/ui/tokens"), reachMsg("tokens.design.ts", "@keel/ui/tokens")].sort(),
        );
        expect(d.map((x) => x.message)).toContain("tokens.ts imports @keel/ui/tokens, check and build time only");
        expect(d.map((x) => x.message)).toContain(
          "tokens.design.ts imports @keel/ui/tokens, check and build time only",
        );
      },
      T,
    );

    it(
      "and none in either file",
      () => {
        expect(at(r, "tokens.ts")).toEqual([]);
        expect(at(r, "tokens.design.ts")).toEqual([]);
        expect(e1818(r)).toHaveLength(2);
      },
      T,
    );
  });
});

describe("k.check-time #2: an exempt-kind file a client entry reaches", () => {
  const SEED_TS = `import { defineTokens } from ${TOKENS}\nexport const seed = defineTokens\n`;
  const HEAD = "import { load } from '../../lib/load.ts'\nimport { theme } from '../../theme.config.ts'\n";
  const files = (head: string): Tree => ({
    ...base(),
    [PAGE]: withPage(head),
    "tokens.ts": TOKENS_TS,
    "test/seed.ts": SEED_TS,
    "theme.config.ts": `import { defineTokens } from ${TOKENS}\nexport const theme = defineTokens\n`,
    "lib/load.ts": "import { seed } from '../test/seed.ts'\nexport const load = seed\n",
  });
  let r: Run;
  beforeAll(() => {
    r = checkOf(files(HEAD));
  }, T);

  it(
    "with `test/seed.ts` and `theme.config.ts` each holding `import { defineTokens } from '@keel/ui/tokens'`, `lib/load.ts` importing `../test/seed.ts`, and `A.tsx` importing `../../lib/load.ts` and `../../theme.config.ts`, `keel check` reports two E1818 in `A.tsx`, at those two specifiers",
    () => {
      const d = at(r, PAGE);
      expect(d).toHaveLength(2);
      expect(d.map((x) => [x.line, x.col]).sort()).toEqual(
        [where(HEAD, "'../../lib/load.ts'"), where(HEAD, "'../../theme.config.ts'")].map((p) => [p.line, p.col]).sort(),
      );
    },
    T,
  );

  it(
    "with messages `test/seed.ts imports @keel/ui/tokens, check and build time only` and `theme.config.ts imports @keel/ui/tokens, check and build time only`",
    () => {
      const d = at(r, PAGE);
      const byLine = (quoted: string) => d.find((x) => x.line === where(HEAD, quoted).line);
      expect(byLine("'../../lib/load.ts'")?.message).toBe(
        "test/seed.ts imports @keel/ui/tokens, check and build time only",
      );
      expect(byLine("'../../theme.config.ts'")?.message).toBe(
        "theme.config.ts imports @keel/ui/tokens, check and build time only",
      );
    },
    T,
  );

  it(
    "and none in `test/seed.ts`, `theme.config.ts` or `lib/load.ts`",
    () => {
      for (const p of ["test/seed.ts", "theme.config.ts", "lib/load.ts"]) expect(at(r, p), p).toEqual([]);
      expect(e1818(r)).toHaveLength(2);
    },
    T,
  );

  it(
    "`export { type Tokens } from '@keel/ui/tokens'` in `A.tsx` is none",
    () => {
      const run = checkOf({
        ...base(),
        [PAGE]: withPage(`export { type Tokens } from ${TOKENS}\n`),
        "tokens.ts": TOKENS_TS,
      });
      expect(e1818(run)).toEqual([]);
    },
    T,
  );

  it(
    "without those two imports in `A.tsx` there is none",
    () => {
      const run = checkOf({ ...files(""), [PAGE]: withPage("") });
      expect(e1818(run)).toEqual([]);
    },
    T,
  );

  describe("a page importing a `*.test.ts` file, a file under a `test/` folder and a `*.config.ts` file, each importing `defineTokens`", () => {
    const KINDS: [string, string][] = [
      ["a `*.test.ts` file", "lib/seed.test.ts"],
      ["a file under a `test/` folder", "test/fixtures/seed.ts"],
      ["a `*.config.ts` file", "lib/theme.config.ts"],
    ];
    for (const [what, path] of KINDS) {
      const head = `import { v } from '../../${path}'\n`;
      it(
        `${what} is refused when the page imports it: one E1818 at the page's own import, \`${path} imports @keel/ui/tokens, check and build time only\`, none in the file`,
        () => {
          const run = checkOf({
            ...base(),
            [PAGE]: withPage(head),
            "tokens.ts": TOKENS_TS,
            [path]: `import { defineTokens } from ${TOKENS}\nexport const v = defineTokens\n`,
          });
          const d = at(run, PAGE);
          expect(d).toHaveLength(1);
          expect(d[0]).toMatchObject({ ...where(head, `'../../${path}'`), message: reachMsg(path, "@keel/ui/tokens") });
          expect(at(run, path)).toEqual([]);
        },
        T,
      );

      it(
        `${what} with no client entry reaching it is allowed`,
        () => {
          const run = checkOf({
            ...base(),
            "tokens.ts": TOKENS_TS,
            [path]: `import { defineTokens } from ${TOKENS}\nexport const v = defineTokens\n`,
          });
          expect(e1818(run)).toEqual([]);
        },
        T,
      );
    }
  });

  describe("how a client entry reaches an exempt file", () => {
    const EXEMPT = (entry: string): string => `import * as e from ${entry}\nexport const v = e\n`;
    const REACH: [string, string][] = [
      ["a value import", "import { v } from '../../theme.config.ts'\nexport const w = v\n"],
      ["a re-export `export * from`", "export * from '../../theme.config.ts'\n"],
      ["an `import()`", "export const w = () => import('../../theme.config.ts')\n"],
    ];
    for (const [how, head] of REACH) {
      it(
        `${how} reaches it: one E1818 at that specifier`,
        () => {
          const run = checkOf({
            ...base(),
            [PAGE]: withPage(head),
            "tokens.ts": TOKENS_TS,
            "theme.config.ts": EXEMPT(CSS),
          });
          const d = at(run, PAGE);
          expect(d).toHaveLength(1);
          expect(d[0]).toMatchObject({
            ...where(head, "'../../theme.config.ts'"),
            message: "theme.config.ts imports @keel/ui/css, check and build time only",
          });
        },
        T,
      );
    }

    it(
      "an `import type` of the exempt file does not reach it: none",
      () => {
        const run = checkOf({
          ...base(),
          [PAGE]: withPage("import type { v } from '../../theme.config.ts'\n"),
          "tokens.ts": TOKENS_TS,
          "theme.config.ts": EXEMPT(CSS),
        });
        expect(e1818(run)).toEqual([]);
      },
      T,
    );

    it(
      "two imports of a chain reaching one file are two E1818, one per import",
      () => {
        const head = "import { a } from '../../lib/one.ts'\nimport { b } from '../../lib/two.ts'\n";
        const run = checkOf({
          ...base(),
          [PAGE]: withPage(head),
          "tokens.ts": TOKENS_TS,
          "test/seed.ts": SEED_TS,
          "lib/one.ts": "import { seed } from '../test/seed.ts'\nexport const a = seed\n",
          "lib/two.ts": "import { seed } from '../test/seed.ts'\nexport const b = seed\n",
        });
        const d = at(run, PAGE);
        expect(d.map((x) => x.line).sort()).toEqual([1, 2]);
        for (const x of d) expect(x.message).toBe("test/seed.ts imports @keel/ui/tokens, check and build time only");
      },
      T,
    );

    it(
      "a file of a `client` module reaching `tokens.ts` is reported at that file's own import",
      () => {
        const head = "import { tokens } from '../../tokens.ts'\nexport const view = tokens\n";
        const run = checkOf({
          ...base(),
          "modules/c/view.ts": head,
          "tokens.ts": `import { defineTokens } from ${TOKENS}\nimport { brandTokens } from '@keel/ui/brand'\nexport const tokens = defineTokens({ ...brandTokens })\n`,
        });
        const d = at(run, "modules/c/view.ts");
        expect(d).toHaveLength(1);
        expect(d[0]).toMatchObject({
          ...where(head, "'../../tokens.ts'"),
          message: "tokens.ts imports @keel/ui/tokens, check and build time only",
        });
        expect(at(run, "tokens.ts")).toEqual([]);
      },
      T,
    );
  });

  it(
    "whatever the exempt file's depth in the chain, its entry and its folder, the report is at the page's first import, `<file>` clipped behind one `.../` until the message is at most 89 units",
    () => {
      const entries = fc.constantFrom("@keel/ui/tokens", "@keel/ui/css");
      const dirs = fc.array(fc.constantFrom("a", "deeply-nested-folder", "x".repeat(24)), {
        minLength: 0,
        maxLength: 4,
      });
      const sample = fc.sample(fc.tuple(entries, dirs, fc.integer({ min: 0, max: 2 })), { seed: SEED, numRuns: 5 });
      const tree: Tree = { ...base(), "tokens.ts": TOKENS_TS };
      let head = "";
      sample.forEach(([entry, folder, depth], i) => {
        const target = `test/${folder.join("/")}${folder.length > 0 ? "/" : ""}seed${i}.ts`;
        tree[target] = `import * as e from '${entry}'\nexport const v${i} = e\n`;
        let next = target;
        for (let k = depth; k > 0; k--) {
          const mid = `lib/p${i}/c${k}.ts`;
          const from = mid.split("/").slice(0, -1).join("/");
          const rel = relativePath(from, next).startsWith(".")
            ? relativePath(from, next)
            : `./${relativePath(from, next)}`;
          tree[mid] = `export { v${i} } from '${rel}'\n`;
          next = mid;
        }
        head += `import { v${i} } from '../../${next}'\n`;
      });
      tree[PAGE] = withPage(head);
      const run = checkOf(tree);
      const d = at(run, PAGE);
      expect(d).toHaveLength(sample.length);
      sample.forEach(([entry, folder], i) => {
        const target = `test/${folder.join("/")}${folder.length > 0 ? "/" : ""}seed${i}.ts`;
        const found = d.find((x) => x.line === i + 1);
        expect(found?.message).toBe(reachMsg(target, entry));
        expect(String(found?.message).length).toBeLessThanOrEqual(89);
      });
    },
    T,
  );
});

describe("k.check-time: E1818 in each form and each placement", () => {
  const FORMS: [string, string, string][] = [
    ["`export ... from`", `export { defineTokens } from ${TOKENS}\n`, "@keel/ui/tokens"],
    ["`export * from`", `export * from ${CSS}\n`, "@keel/ui/css"],
    ["`import()`", `export const load = () => import(${CSS})\n`, "@keel/ui/css"],
    ["`import`", `import { contrastTable } from ${CSS}\nexport const t = contrastTable\n`, "@keel/ui/css"],
  ];
  for (const [form, src, entry] of FORMS) {
    it(
      `a value ${form} of \`${entry}\` in a route component is one E1818 at its specifier`,
      () => {
        const r = checkOf({ ...base(), [PAGE]: withPage(src), "tokens.ts": TOKENS_TS });
        const d = at(r, PAGE);
        expect(d).toHaveLength(1);
        expect(d[0]?.message).toBe(msg(entry));
        expect(d[0]?.line).toBe(1);
      },
      T,
    );
  }

  it(
    "a plain code file of the app that no client entry reaches and no exemption names is E1818 at the specifier",
    () => {
      const r = checkOf({
        ...base(),
        "tokens.ts": TOKENS_TS,
        "lib/free.ts": `import { contrast } from ${CSS}\nexport const f = contrast\n`,
      });
      const d = at(r, "lib/free.ts");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe(msg("@keel/ui/css"));
    },
    T,
  );

  it(
    "a file of a `client` module that is of no exempt kind is E1818 at its own import",
    () => {
      const r = checkOf({
        ...base(),
        "tokens.ts": TOKENS_TS,
        "modules/c/view.ts": `import { defineTokens } from ${TOKENS}\nexport const view = defineTokens\n`,
      });
      expect(at(r, "modules/c/view.ts")).toHaveLength(1);
    },
    T,
  );

  it(
    "whatever the exempt file name (`*.test.*`, `*.spec.*`, `*.config.*`, `*.server.*` of a `node` module) and either entry, a value import there that no client entry reaches is no E1818",
    () => {
      const names = ["x.test.ts", "x.spec.tsx", "x.config.ts", "x.config.mjs", "y.server.ts"];
      const entries = [TOKENS, CSS];
      const sample = fc.sample(fc.tuple(fc.constantFrom(...names), fc.constantFrom(...entries)), {
        seed: SEED,
        numRuns: 6,
      });
      const files: Tree = {};
      for (const [n, e] of sample) files[`modules/s/${n}`] = `import * as e from ${e}\nexport const v = e\n`;
      const r = checkOf({ ...base(), ...files, "tokens.ts": TOKENS_TS });
      expect(sample.length).toBe(6);
      expect(e1818(r)).toEqual([]);
    },
    T,
  );
});
