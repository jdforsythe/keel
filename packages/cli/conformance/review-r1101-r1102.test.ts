// Spec: k.escapes, clause "A lockfile entry moved to a `git+https:` or `file:` resolution is R1101; a `postinstall` in any tracked `package.json` is R1102."
// Seed: n/a. Pending: `keel review` is not built.
// ASSUMED lockfile text: pnpm-lock.yaml, `packages:` keyed by `name@version` with a `resolution: {...}` flow mapping; the
// spec names the two resolution kinds but not the lockfile format.
import { expect, test } from "vitest";
import { PROJECT, ofCode, range, review, withRepo } from "./review-support.ts";

const lock = (resolution: string): string =>
  `lockfileVersion: '9.0'\npackages:\n  left-pad@1.0.0:\n    resolution: ${resolution}\n`;
const REGISTRY =
  "{integrity: sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==}";
const MOVED = ["{tarball: git+https://example.invalid/left-pad.git}", "{tarball: file:../left-pad.tgz}"];

test("A lockfile entry moved to a `git+https:` or `file:` resolution is R1101; a `postinstall` in any tracked `package.json` is R1102.", () => {
  for (const moved of MOVED) {
    withRepo([{ ...PROJECT, "pnpm-lock.yaml": lock(REGISTRY) }, { "pnpm-lock.yaml": lock(moved) }], (repo) => {
      const hits = ofCode(review(repo, [range(repo, 0, 1)]), "R1101");
      expect(hits, moved).toHaveLength(1);
      expect(hits[0]?.danger).toBe("critical");
    });
  }
  withRepo(
    [{ ...PROJECT, "pnpm-lock.yaml": lock(REGISTRY) }, { "modules/m/a.ts": "export const a = 2;\n" }],
    (repo) => {
      expect(ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1101")).toEqual([]);
    },
  );
  for (const path of ["package.json", "apps/x/package.json"]) {
    const pkg = `${JSON.stringify({ name: "p", scripts: { postinstall: "node setup.js" } })}\n`;
    withRepo([{ ...PROJECT, "apps/x/package.json": '{"name":"x"}\n' }, { [path]: pkg }], (repo) => {
      expect(ofCode(review(repo, [range(repo, 0, 1)]), "R1102"), path).toHaveLength(1);
    });
  }
});
