// Spec: k.supervise, clause "In that app, `keel review` reports for `modules/app/runIt.ts` holding `import { swallow } from '@fx/sup'` and `export const runIt = (ctx: Ctx) => swallow(ctx, () => 1)` one R1018 at the `swallow(` call, message `swallow supervises its work (libs/sup/src/swallow.ts)`, and the same through `import * as sup from '@fx/sup'` and `sup.swallow(ctx, () => 1)`; for a call of an exported function of the library whose body holds no `supervise` call, none."
// Seed 1337 (no generated input: the forms are source text). Each case writes one repository and reads one review, as review-r1018-r1020.test.ts does.
// "That app" is the previous clause's (supervise-workspace-library.test.ts): `libs/sup` as it gives it, with no manifest listing it and no `node_modules` link (review reads the tree's library folders).
// Fixture: the library also exports `plain`, from `libs/sup/src/plain.ts`, whose body holds no `supervise` call.
import { testTime } from "@keel/tooling/test-time";
import { describe, expect, test } from "vitest";
import { PROJECT, lineOf, ofCode, range, review, withRepo } from "./review-support.ts";

const LIB = {
  "libs/sup/package.json":
    '{"name":"@fx/sup","version":"0.0.0","type":"module","keel":"library","exports":{".":{"keel":"./src/index.ts"}}}',
  "libs/sup/module.ts":
    "import { module } from '@keel/compiler'\nexport default module({ id: 'sup', deps: [], capabilities: [], public: { exports: [] } })\n",
  "libs/sup/src/index.ts": "export { swallow } from './swallow.ts'\nexport { plain } from './plain.ts'\n",
  "libs/sup/src/swallow.ts":
    "import { supervise } from '@keel/ctx'\nimport type { Ctx } from '@keel/ctx'\nimport { s } from '@keel/schema'\nconst T = s.error('sup.thrown', s.object({})).make({})\nexport function swallow(ctx: Ctx, f: () => number) {\n  return supervise(ctx, 'sup.run', f, T)\n}\n",
  "libs/sup/src/plain.ts":
    "import type { Ctx } from '@keel/ctx'\nexport function plain(_ctx: Ctx, f: () => number) {\n  return f()\n}\n",
};
const APP = "import type { Ctx } from '@keel/ctx'\n";
const MESSAGE = "swallow supervises its work (libs/sup/src/swallow.ts)";
const hits = (runIt: string) =>
  withRepo([PROJECT, { ...LIB, "modules/app/runIt.ts": runIt }], (repo) =>
    ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1018").filter((f) => f.path === "modules/app/runIt.ts"),
  );

describe("k.supervise Who writes it: R1018 one hop out", () => {
  const FORMS: readonly (readonly [string, string, string])[] = [
    [
      "a named import",
      `${APP}import { swallow } from '@fx/sup'\nexport const runIt = (ctx: Ctx) => swallow(ctx, () => 1)\n`,
      "swallow(ctx",
    ],
    [
      "a namespace import",
      `${APP}import * as sup from '@fx/sup'\nexport const runIt = (ctx: Ctx) => sup.swallow(ctx, () => 1)\n`,
      "sup.swallow(ctx",
    ],
  ];
  for (const [how, source, call] of FORMS) {
    test(
      `through ${how}, \`keel review\` reports one R1018 in \`modules/app/runIt.ts\` at the \`swallow(\` call, message \`${MESSAGE}\``,
      () => {
        const h = hits(source);
        expect(h).toHaveLength(1);
        expect(h[0]?.message).toBe(MESSAGE);
        expect(h[0]?.line).toBe(lineOf(source, call));
        // The column is asserted for the named form only: for `sup.swallow(` the text does not say whether the call starts at `sup` or at `swallow`.
        if (how === "a named import") {
          const text = source.split("\n")[lineOf(source, call) - 1] ?? "";
          expect(h[0]?.col).toBe(text.indexOf(call) + 1);
        }
      },
      testTime(120_000),
    );
  }

  test(
    "for a call of an exported function of the library whose body holds no `supervise` call, `keel review` reports no R1018",
    () => {
      expect(
        hits(`${APP}import { plain } from '@fx/sup'\nexport const runIt = (ctx: Ctx) => plain(ctx, () => 1)\n`),
      ).toEqual([]);
    },
    testTime(120_000),
  );
});
