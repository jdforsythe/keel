// Spec: k.bundle, Conformance "In a plain file, `R.loader(...)` through `import * as R from '@keel/router'`, `loader` re-exported through `lib/r.ts`, `const L = loader`, and `R.guard(...)`: each one E1551 (E1009 for the guard) in `keel check` and one E1007 `handler` in `vite build`."
// Spec: k.bundle, Handlers "E1551, E1009 and E1007's reason `handler` use this one definition."
// Seed 1337 (no random input: each spelling is enumerated). `vite build` with `KEEL_DEPLOYABLE=api` over a temp project and the real `keel check` over the same files. The check half over in-memory trees is packages/check/conformance/bundle-handlers.test.ts.
// `Page.tsx` imports `modules/a/plain.ts` and reads it. For the spelling that re-exports through `lib/r.ts` the E1007 may name `plain.ts` (which calls it) or `lib/r.ts` (which re-exports it) as its last step: the spec says one E1007 and names neither.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { filesUnder, keelRun, linesWith, viteBuild } from "./boundary-support.ts";
import { chainOf, inProject, nodeWith, page, reasonOf } from "./bundle-support.ts";

const HEAD = "import { ok, s } from '@keel/schema'\n";
const LOADER = "{ output: s.object({}) }, async () => ok({})";
const GUARD = "{ redirect: 'a.home' }, async () => ok(null)";

const cases = {
  "`R.loader(...)` through `import * as R from '@keel/router'`": {
    files: {
      "modules/a/plain.ts": `import * as R from '@keel/router'\n${HEAD}export const plain = R.loader(${LOADER})\n`,
    },
    code: "E1551",
    ends: ["modules/a/plain.ts"],
  },
  "`loader` re-exported through `lib/r.ts`": {
    files: {
      "lib/r.ts": "export { loader } from '@keel/router'\n",
      "modules/a/plain.ts": `import { loader } from '../../lib/r.ts'\n${HEAD}export const plain = loader(${LOADER})\n`,
    },
    code: "E1551",
    ends: ["modules/a/plain.ts", "lib/r.ts"],
  },
  "`const L = loader`": {
    files: {
      "modules/a/plain.ts": `import { loader } from '@keel/router'\n${HEAD}const L = loader\nexport const plain = L(${LOADER})\n`,
    },
    code: "E1551",
    ends: ["modules/a/plain.ts"],
  },
  "`R.guard(...)` through `import * as R from '@keel/router'`": {
    files: {
      "modules/a/plain.ts": `import * as R from '@keel/router'\n${HEAD}export const plain = R.guard(${GUARD})\n`,
    },
    code: "E1009",
    ends: ["modules/a/plain.ts"],
  },
} as const;

const fixture = (name: keyof typeof cases) =>
  nodeWith({ ...cases[name].files, "modules/a/Page.tsx": page("import { plain } from './plain.ts'", "plain") });

describe("k.bundle Handlers: a handler used in a plain file is one E1007 `handler` in `vite build` and E1551 or E1009 in `keel check`", () => {
  for (const name of Object.keys(cases) as (keyof typeof cases)[]) {
    test(`${name}, imported by \`Page.tsx\`: \`vite build\` exits 1 with one E1007 \`handler\` whose chain runs from \`modules/a/Page.tsx\`, and nothing is written`, async () => {
      await inProject(fixture(name), (dir) => {
        const r = viteBuild(dir, "api");
        expect(r.status, r.out).toBe(1);
        const hits = linesWith(r.out, "E1007");
        expect(hits, r.out).toHaveLength(1);
        expect(reasonOf(hits[0] ?? "")).toBe("handler");
        const chain = chainOf(hits[0] ?? "");
        expect(chain).toContain("modules/a/Page.tsx");
        expect(cases[name].ends).toContain(chain.at(-1));
        expect(existsSync(join(dir, "dist", "api"))).toBe(false);
        expect(filesUnder(join(dir, "dist"))).toEqual([]);
      });
    });

    test(`\`keel check\` of the ${name} fixture reports ${cases[name].code}`, async () => {
      await inProject(fixture(name), (dir) => {
        const r = keelRun(dir, ["check"]);
        expect(r.status, r.out).toBe(1);
        expect(linesWith(r.out, `"${cases[name].code}"`).length, r.out).toBeGreaterThan(0);
      });
    });
  }
});
