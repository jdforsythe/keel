// Spec: k.escapes, clause "A range changing `packages/compiler/src/a.ts` and `apps/x/modules/m/a.ts` is one R1100; one changing only the first is none."
// Seed: n/a. Pending: `keel review` is not built.
import { expect, test } from "vitest";
import { ofCode, range, review, withRepo } from "./review-support.ts";

const BASE = {
  "package.json": '{"name":"fx","private":true}\n',
  "packages/compiler/src/a.ts": "export const c = 1;\n",
  "apps/x/topology.ts": "export default {};\n",
  "apps/x/modules/m/a.ts": "export const a = 1;\n",
};

test.skip("A range changing `packages/compiler/src/a.ts` and `apps/x/modules/m/a.ts` is one R1100; one changing only the first is none.", () => {
  withRepo(
    [
      BASE,
      { "packages/compiler/src/a.ts": "export const c = 2;\n" },
      { "packages/compiler/src/a.ts": "export const c = 3;\n", "apps/x/modules/m/a.ts": "export const a = 2;\n" },
    ],
    (repo) => {
      expect(ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1100")).toEqual([]);
      const both = ofCode(review(repo, [range(repo, 1, 2)]), "R1100");
      expect(both).toHaveLength(1);
      expect(both[0]?.danger).toBe("critical");
      expect(both[0]?.novelty).toBe("new");
    },
  );
});
