// Spec: k.themes, clause "In a project with a `node` module `a`, `import { defineTokens } from '@keel/ui/tokens'` in route component `modules/a/A.tsx` is one E1818 at the specifier with message `@keel/ui/tokens is check and build time only; use token names or @keel/ui/brand`, and `import { contrast } from '@keel/ui/css'` in `lib/tone.ts`, which `A.tsx` imports, one with `@keel/ui/css`; there is none for those imports in `tokens.ts`, in `tokens.design.ts` that only `tokens.ts` imports, in `modules/a/A.test.tsx`, in `vite.config.ts` or in `modules/a/a.server.ts`, nor for `import type { Tokens } from '@keel/ui/tokens'` in `A.tsx`; when `A.tsx` also imports `tokens.ts`, `tokens.ts`'s import is one E1818; `keel build` with any E1818 exits 1 and writes no `dist/`."
// Seed: 1337 (no generated input: three spawned `keel build` runs).
// The `keel build` half of the clause; the `keel check` half is check-time-entries-e1818.test.ts. The control build is the same project with no E1818: it exits 0 and writes `dist/`, so the cases are not vacuous.
// The control's type-only import names `TokenSchema`, not the clause's `Tokens`: `@keel/ui/tokens` exports no `Tokens` (TS2305, E1751), so the clause's own import fails `keel build` on a type error that is no E1818.
// ASSUMPTIONS: as check-time-entries-e1818.test.ts (compat-support's `staticTree`, route component `modules/s/Page.tsx`, standing for `A.tsx`); the project is the `static` fixture because its build is known to complete; the build runs `keel check` first (k.boundary Build gate), so an error ends it with nothing written.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Run, type Tree, cleanup, diags, keel, materialize } from "./compat-support.ts";
import { SLOW, staticTree } from "./static-support.ts";

const TOKENS_TS = "import { brandTokens } from '@keel/ui/brand'\nexport const tokens = brandTokens\n";
const PAGE = "modules/s/Page.tsx";
const tree = (head: string, extra: Tree = {}): Tree => {
  const t = staticTree("none");
  return { ...t, "tokens.ts": TOKENS_TS, [PAGE]: `${head}${t[PAGE] ?? ""}`, ...extra };
};
const dirs: string[] = [];
const run = (t: Tree): { dir: string; run: Run } => {
  const dir = materialize(t);
  dirs.push(dir);
  return { dir, run: keel(dir, ["build"]) };
};
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

describe("k.themes: `keel build` and E1818", () => {
  let control: { dir: string; run: Run };
  let tokensImport: { dir: string; run: Run };
  let cssImport: { dir: string; run: Run };
  beforeAll(() => {
    control = run(tree("import type { TokenSchema } from '@keel/ui/tokens'\n"));
    tokensImport = run(tree("import { defineTokens } from '@keel/ui/tokens'\n"));
    cssImport = run(
      tree("import { tone } from '../../lib/tone.ts'\n", {
        "lib/tone.ts": "import { contrast } from '@keel/ui/css'\nexport const tone = contrast\n",
      }),
    );
  }, SLOW * 3);

  it(
    "a project with no E1818 (a type-only import of `TokenSchema` from `@keel/ui/tokens` in the page) builds: exit 0 and a `dist/`",
    () => {
      expect(control.run.status).toBe(0);
      expect(diags(control.run, "E1818")).toEqual([]);
      expect(existsSync(join(control.dir, "dist"))).toBe(true);
    },
    SLOW,
  );

  it(
    "`keel build` with an E1818 for `@keel/ui/tokens` in a route component exits 1, prints it and writes no `dist/`",
    () => {
      expect(tokensImport.run.status).toBe(1);
      expect(diags(tokensImport.run, "E1818")).toHaveLength(1);
      expect(existsSync(join(tokensImport.dir, "dist"))).toBe(false);
    },
    SLOW,
  );

  it(
    "`keel build` with an E1818 for `@keel/ui/css` in a file a route component imports exits 1, prints it and writes no `dist/`",
    () => {
      expect(cssImport.run.status).toBe(1);
      expect(diags(cssImport.run, "E1818")).toHaveLength(1);
      expect(existsSync(join(cssImport.dir, "dist"))).toBe(false);
    },
    SLOW,
  );
});
