// Spec: k.privacy, Rules "E1105 `reveal` imported in an app file other than `*.server.ts`."
// Seed: 1337.
// Skipped until the rule is attributed to k.privacy; it has no fix (fix-diffs.test.ts records it).
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Files } from "./support.ts";
import { SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = f(
  "modules/app/module.ts",
  `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`,
);
const e1105 = (files: Files) =>
  check([MANIFEST, ...files], { types: false }).diagnostics.filter((d) => d.code === "E1105");

const name = fc.stringMatching(/^[a-z]{4,9}$/);
const ext = fc.constantFrom(".ts", ".tsx", ".schema.ts", ".test.ts");
const reveal = `import { reveal } from '@keel/schema'\nexport const x = reveal\n`;

describe("k.privacy E1105", () => {
  it.skip("E1105 fires on `reveal` imported from @keel/schema in an app file that is not *.server.ts", () => {
    fc.assert(
      fc.property(name, ext, (n, e) => {
        const ds = e1105([f(`modules/app/${n}${e}`, reveal)]);
        expect(ds).toHaveLength(1);
        expect(ds[0]?.fix).toBeUndefined();
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it.skip("E1105 does not fire on the same import in a *.server.ts file", () => {
    fc.assert(
      fc.property(name, (n) => {
        expect(e1105([f(`modules/app/${n}.server.ts`, reveal)])).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
