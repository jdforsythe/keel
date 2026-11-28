// Spec: k.check-time, clause "In a project with a `node` module `a`, `import { defineTokens } from '@keel/ui/tokens'` in route component `modules/a/A.tsx` is one E1818 at the specifier with message `@keel/ui/tokens is check and build time only; use token names or @keel/ui/brand`, and `import { contrast } from '@keel/ui/css'` in `lib/tone.ts`, which `A.tsx` imports, one with `@keel/ui/css`; there is none for those imports in `tokens.ts`, in `tokens.design.ts` that only `tokens.ts` imports, in `modules/a/A.test.tsx`, in `vite.config.ts` or in `modules/a/a.server.ts`, nor for `import type { Tokens } from '@keel/ui/tokens'` in `A.tsx`; when `A.tsx` also imports `tokens.ts`, there are two E1818, both at `A.tsx`'s specifier `'../../tokens.ts'`, with messages `tokens.ts imports @keel/ui/tokens, check and build time only` and `tokens.design.ts imports @keel/ui/tokens, check and build time only`, and none in either file; `keel build` with any E1818 exits 1 and writes no `dist/`."
// Spec: k.check-time, clause "In that project, with `test/seed.ts` and `theme.config.ts` each holding `import { defineTokens } from '@keel/ui/tokens'`, `lib/load.ts` importing `../test/seed.ts`, and `A.tsx` importing `../../lib/load.ts` and `../../theme.config.ts`, `keel check` reports two E1818 in `A.tsx`, at those two specifiers, with messages `test/seed.ts imports @keel/ui/tokens, check and build time only` and `theme.config.ts imports @keel/ui/tokens, check and build time only`, and none in `test/seed.ts`, `theme.config.ts` or `lib/load.ts`; `export { type Tokens } from '@keel/ui/tokens'` in `A.tsx` is none; without those two imports in `A.tsx` there is none."
// Sentence of k.check-time Where it is reported: "A reached file importing both entries, or one twice, is one E1818 per such import, naming the entry of its first; a client entry importing one file twice is reported at each import."
// Sentence of k.check-time Where it is reported: "A `*.server.*` file of a module only `client` deployables list is not server-only (k.boundary Server-only) but a client entry, so its import is E1818 at its specifier."
// Sentence of k.check-time Where it is reported: "`<file>` the reached file's path from the project root, its leading segments dropped one at a time behind one `.../` until the message is at most 89 units, then its last segment keeping its first units and `...` until it is."
// Sentence of k.check-time Where it is reported: "A chain stops at a client entry outside `node_modules/`, which reports for itself, so each reached file is reported only at the entries nearest it."
// Seed: 1337 (fc.sample below). No `test.skip`: plain tests.
// The `keel check` half beside check-time-entries-e1818.test.ts (same fixture: compat-support's `staticTree` with adapter `node`, route component `modules/s/Page.tsx` standing for `A.tsx`, a `client` deployable `web` listing module `c`).
// ASSUMPTIONS: "its first" is the first import in source order; a file of the `client` module `c` is a client entry (k.check-time Entries) and `modules/s/Page.tsx` may import it by a relative specifier; the shortening's last step (the last segment cut to its first units and `...`) leaves a message of exactly 89 units, as units are dropped one at a time.
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { type Run, type Tree, cleanup, diags, keel, materialize } from "./compat-support.ts";
import { staticTree } from "./static-support.ts";

const SEED = 1337;
const T = fixedTime(300_000);
const TOKENS = "'@keel/ui/tokens'";
const CSS = "'@keel/ui/css'";
const msg = (entry: string): string => `${entry} is check and build time only; use token names or @keel/ui/brand`;
const reached = (file: string, entry: string): string => `${file} imports ${entry}, check and build time only`;
/** The message of a reached file, its path clipped as the clause says. */
const clipped = (file: string, entry: string): string => {
  const segs = file.split("/");
  for (let k = 0; k < segs.length; k++) {
    const shown = k === 0 ? file : `.../${segs.slice(k).join("/")}`;
    if (reached(shown, entry).length <= 89) return reached(shown, entry);
  }
  const last = segs[segs.length - 1] ?? "";
  for (let n = last.length - 1; n >= 0; n--) {
    const m = reached(`.../${last.slice(0, n)}...`, entry);
    if (m.length <= 89) return m;
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
  "tokens.ts": "import { brandTokens } from '@keel/ui/brand'\nexport const tokens = brandTokens\n",
});
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const checkOf = (tree: Tree): Run => {
  const d = materialize(tree);
  dirs.push(d);
  return keel(d, ["check"]);
};
const e1818 = (r: Run) => diags(r, "E1818");
const at = (r: Run, path: string) => e1818(r).filter((d) => d.path === path);
const where = (head: string, quoted: string): { line: number; col: number } => {
  const lines = head.split("\n");
  const i = lines.findIndex((l) => l.includes(quoted));
  return { line: i + 1, col: (lines[i] ?? "").indexOf(quoted) + 1 };
};
const THEME = "theme.config.ts";
const HEAD_THEME = "import { theme } from '../../theme.config.ts'\nexport const w = theme\n";

describe("k.check-time: a reached file importing both entries, or one twice", () => {
  const orders: string[][] = [
    [TOKENS, CSS],
    [CSS, TOKENS],
    [TOKENS, TOKENS],
    [CSS, TOKENS, CSS],
  ];
  for (const order of orders) {
    const imports = order.map((e, i) => `import * as e${i} from ${e}\n`).join("");
    const first = order[0]?.replaceAll("'", "") ?? "";
    it(
      `a reached file importing ${order.join(" then ")} is one E1818 at the client entry's import, naming \`${first}\`, the entry of its first`,
      () => {
        const r = checkOf({ ...base(), [PAGE]: withPage(HEAD_THEME), [THEME]: `${imports}export const theme = 1\n` });
        const d = at(r, PAGE);
        expect(d).toHaveLength(1);
        expect(d[0]).toMatchObject({ ...where(HEAD_THEME, "'../../theme.config.ts'"), message: reached(THEME, first) });
        expect(e1818(r)).toHaveLength(1);
      },
      T,
    );
  }

  it(
    "whatever the order of its imports of both entries, the one E1818 per client import names the entry of the first",
    () => {
      const pick = fc.array(fc.constantFrom(TOKENS, CSS), { minLength: 1, maxLength: 4 });
      for (const order of fc.sample(pick, { seed: SEED, numRuns: 4 })) {
        const imports = order.map((e, i) => `import * as e${i} from ${e}\n`).join("");
        const r = checkOf({ ...base(), [PAGE]: withPage(HEAD_THEME), [THEME]: `${imports}export const theme = 1\n` });
        const d = at(r, PAGE);
        expect(d, order.join()).toHaveLength(1);
        expect(d[0]?.message).toBe(reached(THEME, order[0]?.replaceAll("'", "") ?? ""));
      }
    },
    T,
  );

  it(
    "a client entry importing one file twice is reported at each import",
    () => {
      const head =
        "import { a } from '../../theme.config.ts'\nimport { b } from '../../theme.config.ts'\nexport const w = [a, b]\n";
      const r = checkOf({
        ...base(),
        [PAGE]: withPage(head),
        [THEME]: `import * as e from ${TOKENS}\nexport const a = e\nexport const b = e\n`,
      });
      const d = at(r, PAGE);
      expect(d.map((x) => x.line).sort()).toEqual([1, 2]);
      for (const x of d) expect(x.message).toBe(reached(THEME, "@keel/ui/tokens"));
      expect(d.map((x) => x.col)).toEqual([
        where(head, "'../../theme.config.ts'").col,
        where(head, "'../../theme.config.ts'").col,
      ]);
    },
    T,
  );
});

describe("k.check-time: a `*.server.*` file of a module only `client` deployables list", () => {
  const SRC = `import { defineTokens } from ${TOKENS}\nexport const v = defineTokens\n`;
  it(
    "is a client entry, so its import is E1818 at its specifier",
    () => {
      const r = checkOf({ ...base(), "modules/c/view.server.ts": SRC });
      const d = at(r, "modules/c/view.server.ts");
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject({ line: 1, col: SRC.indexOf(TOKENS) + 1, message: msg("@keel/ui/tokens") });
    },
    T,
  );

  it(
    "while a `*.server.*` file of a module a `node` deployable lists is server-only: none",
    () => {
      const r = checkOf({ ...base(), "modules/s/note.server.ts": SRC });
      expect(at(r, "modules/s/note.server.ts")).toEqual([]);
    },
    T,
  );
});

describe("k.check-time: `<file>` clipped until the message is at most 89 units", () => {
  it(
    "its leading segments are dropped one at a time behind one `.../`, then its last segment keeps its first units and `...`, whatever the depth and the length",
    () => {
      const seg = fc.constantFrom("a", "folder", "deeply-nested-folder", "x".repeat(30));
      const name = fc.integer({ min: 4, max: 140 }).map((n) => "n".repeat(n));
      const sample = fc.sample(
        fc.tuple(fc.array(seg, { minLength: 1, maxLength: 5 }), name, fc.constantFrom(TOKENS, CSS)),
        {
          seed: SEED,
          numRuns: 6,
        },
      );
      const tree = base();
      let head = "";
      const files: [string, string][] = [];
      sample.forEach(([folder, nm, entry], i) => {
        const file = `test/${folder.join("/")}/${nm}${i}.ts`;
        files.push([file, entry.replaceAll("'", "")]);
        tree[file] = `import * as e from ${entry}\nexport const v${i} = e\n`;
        head += `import { v${i} } from '../../${file}'\n`;
      });
      tree[PAGE] = withPage(head);
      const d = at(checkOf(tree), PAGE);
      expect(d).toHaveLength(files.length);
      files.forEach(([file, entry], i) => {
        const found = String(d.find((x) => x.line === i + 1)?.message);
        expect(found, file).toBe(clipped(file, entry));
        expect(found.length).toBeLessThanOrEqual(89);
      });
    },
    T,
  );

  it(
    "a last segment too long for any `.../<last>` is cut to its first units and `...`, the message exactly 89 units",
    () => {
      const file = `test/${"y".repeat(120)}.ts`;
      const r = checkOf({
        ...base(),
        [PAGE]: withPage("import { v } from '../../" + `${file}'\n`),
        [file]: `import * as e from ${CSS}\nexport const v = e\n`,
      });
      const m = String(at(r, PAGE)[0]?.message);
      expect(m.length).toBe(89);
      expect(m.startsWith(".../yyyy")).toBe(true);
      expect(m.endsWith("... imports @keel/ui/css, check and build time only")).toBe(true);
    },
    T,
  );
});

describe("k.check-time: a chain stops at a client entry outside `node_modules/`", () => {
  const VIEW = "modules/c/view.ts";
  const THEME_SRC = `import * as e from ${TOKENS}\nexport const theme = e\n`;
  const VIEW_SRC = "import { theme } from '../../theme.config.ts'\nexport const view = theme\n";

  it(
    "a route component reaching a `client` module's file that reaches an exempt file is reported at that file only, not at the route component",
    () => {
      const head = "import { view } from '../c/view.ts'\nexport const w = view\n";
      const r = checkOf({ ...base(), [PAGE]: withPage(head), [VIEW]: VIEW_SRC, [THEME]: THEME_SRC });
      expect(at(r, PAGE)).toEqual([]);
      const d = at(r, VIEW);
      expect(d).toHaveLength(1);
      expect(d[0]).toMatchObject({
        ...where(VIEW_SRC, "'../../theme.config.ts'"),
        message: reached(THEME, "@keel/ui/tokens"),
      });
      expect(e1818(r)).toHaveLength(1);
    },
    T,
  );

  it(
    "each reached file is reported only at the entries nearest it: the route component importing the file itself is reported for its own import, the client file for its own, one each",
    () => {
      const head =
        "import { view } from '../c/view.ts'\nimport { theme } from '../../theme.config.ts'\nexport const w = [view, theme]\n";
      const r = checkOf({ ...base(), [PAGE]: withPage(head), [VIEW]: VIEW_SRC, [THEME]: THEME_SRC });
      const inPage = at(r, PAGE);
      expect(inPage).toHaveLength(1);
      expect(inPage[0]).toMatchObject({
        ...where(head, "'../../theme.config.ts'"),
        message: reached(THEME, "@keel/ui/tokens"),
      });
      expect(at(r, VIEW)).toHaveLength(1);
      expect(e1818(r)).toHaveLength(2);
    },
    T,
  );
});
