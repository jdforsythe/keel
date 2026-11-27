// Spec: k.themes, clause "In a project with a `node` module `a`, `import { defineTokens } from '@keel/ui/tokens'` in route component `modules/a/A.tsx` is one E1818 at the specifier with message `@keel/ui/tokens is check and build time only; use token names or @keel/ui/brand`, and `import { contrast } from '@keel/ui/css'` in `lib/tone.ts`, which `A.tsx` imports, one with `@keel/ui/css`; there is none for those imports in `tokens.ts`, in `tokens.design.ts` that only `tokens.ts` imports, in `modules/a/A.test.tsx`, in `vite.config.ts` or in `modules/a/a.server.ts`, nor for `import type { Tokens } from '@keel/ui/tokens'` in `A.tsx`; when `A.tsx` also imports `tokens.ts`, `tokens.ts`'s import is one E1818; `keel build` with any E1818 exits 1 and writes no `dist/`."
// Paragraph k.themes Check-time entries (no Conformance sentence of its own): "A value import of either (`import`, `export ... from` or `import()`; `import type` is free) is E1818 at its specifier in each code file (k.check Trailer) of an app or library, but in a server-only file (k.boundary), a test file (`*.test.*`, `*.spec.*`) and a tool config (`*.config.*`), and in `tokens.ts` at a project root, each file it imports and a library's `src/<id>Tokens.ts` (k.looks) while no client entry reaches them: no route `component` and no file of a `client` module, by value imports, re-exports and `import()` (k.boundary Following). Message: `<entry> is check and build time only; use token names or @keel/ui/brand`, `<entry>` `@keel/ui/tokens` or `@keel/ui/css`; fix: none."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until the build follows.
// The `keel check` half over the real binary; the `keel build` half is check-time-entries-build.test.ts, the library half packages/check/conformance/check-time-entries-library.test.ts.
// ASSUMPTIONS (spec names no fixture layout): the project is compat-support's `staticTree` (module `s`, route component `modules/s/Page.tsx`, `modules/s/home.server.ts`) with `adapter: 'node'`, standing for the clause's module `a`, `A.tsx`, `A.test.tsx` and `a.server.ts`; a second deployable `web` of adapter `client` lists module `c`, whose every file is a client entry. A diagnostic's position is the opening quote of the specifier, as E1013's, in a record `{ kind: "diag", code, path, line, col, message }`.
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

describe("k.themes: where the check-time entries may be imported", () => {
  const L_PAGE = `import { defineTokens } from ${TOKENS}\nimport type { Tokens } from ${TOKENS}\nimport { tone } from '../../lib/tone.ts'\n`;
  let r1: Run;
  beforeAll(() => {
    r1 = keel(
      make({
        ...base(),
        [PAGE]: withPage(L_PAGE),
        "lib/tone.ts": `import { contrast } from ${CSS}\nexport const tone = contrast\n`,
        "tokens.ts": `import { defineTokens } from ${TOKENS}\nimport { brandTokens } from '@keel/ui/brand'\nimport './tokens.design.ts'\nexport const tokens = defineTokens({ ...brandTokens })\n`,
        "tokens.design.ts": `import { contrast } from ${CSS}\nexport const d = contrast\n`,
        "modules/s/Page.test.tsx": `import { defineTokens } from ${TOKENS}\nexport const t = defineTokens\n`,
        "modules/s/Page.spec.tsx": `import { contrast } from ${CSS}\nexport const t = contrast\n`,
        "vite.config.ts": `import { defineTokens } from ${TOKENS}\nimport keel from '@keel/compiler/vite'\nimport { defineConfig } from 'vite'\nexport const t = defineTokens\nexport default defineConfig({ plugins: [keel()] })\n`,
        "tailwind.config.ts": `import { contrast } from ${CSS}\nexport default contrast\n`,
        "modules/s/note.server.ts": `import { defineTokens } from ${TOKENS}\nexport const note = defineTokens\n`,
      }),
      ["check"],
    );
  }, T);

  it(
    "`import { defineTokens } from '@keel/ui/tokens'` in route component `modules/a/A.tsx` is one E1818 at the specifier with message `@keel/ui/tokens is check and build time only; use token names or @keel/ui/brand`",
    () => {
      const d = at(r1, PAGE);
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
    "nor for `import type { Tokens } from '@keel/ui/tokens'` in `A.tsx`: its only E1818 is line 1's",
    () => {
      expect(at(r1, PAGE).map((d) => d.line)).toEqual([1]);
      expect(e1818(r1)).toHaveLength(2);
    },
    T,
  );

  it(
    "when `A.tsx` also imports `tokens.ts`, `tokens.ts`'s import is one E1818",
    () => {
      const r = keel(
        make({
          ...base(),
          [PAGE]: withPage("import { tokens } from '../../tokens.ts'\n"),
          "tokens.ts": `import { defineTokens } from ${TOKENS}\nimport { brandTokens } from '@keel/ui/brand'\nexport const tokens = defineTokens({ ...brandTokens })\n`,
        }),
        ["check"],
      );
      const d = at(r, "tokens.ts");
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject({ message: msg("@keel/ui/tokens"), line: 1 });
    },
    T,
  );

  it(
    "a file `tokens.ts` imports is E1818 too once a client entry reaches it, as `tokens.ts` itself is",
    () => {
      const r = keel(
        make({
          ...base(),
          [PAGE]: withPage("import { tokens } from '../../tokens.ts'\n"),
          "tokens.ts": `import { brandTokens } from '@keel/ui/brand'\nimport { d } from './tokens.design.ts'\nexport const tokens = { ...brandTokens, d }\n`,
          "tokens.design.ts": `import { contrast } from ${CSS}\nexport const d = contrast\n`,
        }),
        ["check"],
      );
      expect(at(r, "tokens.design.ts")).toHaveLength(1);
    },
    T,
  );
});

describe("k.themes: E1818 in each form and each placement", () => {
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
        const r = keel(make({ ...base(), [PAGE]: withPage(src), "tokens.ts": TOKENS_TS }), ["check"]);
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
      const r = keel(
        make({
          ...base(),
          "tokens.ts": TOKENS_TS,
          "lib/free.ts": `import { contrast } from ${CSS}\nexport const f = contrast\n`,
        }),
        ["check"],
      );
      const d = at(r, "lib/free.ts");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe(msg("@keel/ui/css"));
    },
    T,
  );

  it(
    "every file of a `client` module is a client entry: a `*.server.*` file of module `c`, which only `client` deployables list, and its other files are each E1818",
    () => {
      const r = keel(
        make({
          ...base(),
          "tokens.ts": TOKENS_TS,
          "modules/c/view.ts": `import { defineTokens } from ${TOKENS}\nexport const view = defineTokens\n`,
          "modules/c/load.server.ts": `import { contrast } from ${CSS}\nexport const load = contrast\n`,
        }),
        ["check"],
      );
      expect(at(r, "modules/c/view.ts")).toHaveLength(1);
      expect(at(r, "modules/c/load.server.ts")).toHaveLength(1);
    },
    T,
  );

  it(
    "whatever the exempt file name (`*.test.*`, `*.spec.*`, `*.config.*`, `*.server.*` of a `node` module) and either entry, a value import there is no E1818",
    () => {
      const names = ["x.test.ts", "x.spec.tsx", "x.config.ts", "x.config.mjs", "y.server.ts"];
      const entries = [TOKENS, CSS];
      const sample = fc.sample(fc.tuple(fc.constantFrom(...names), fc.constantFrom(...entries)), {
        seed: SEED,
        numRuns: 6,
      });
      const files: Tree = {};
      for (const [n, e] of sample) files[`modules/s/${n}`] = `import * as e from ${e}\nexport const v = e\n`;
      const r = keel(make({ ...base(), ...files, "tokens.ts": TOKENS_TS }), ["check"]);
      expect(sample.length).toBe(6);
      expect(e1818(r)).toEqual([]);
    },
    T,
  );
});
