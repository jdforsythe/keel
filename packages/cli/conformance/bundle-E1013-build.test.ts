// Spec: k.bundle, Aliases "E1013 is a check error, so `keel build` stops at its check step (k.boundary Build gate) and E1011 is never reached through it."
// Spec: k.bundle, Conformance "`keel check` of that fixture with a symlink `node_modules/linked-notes` to `modules/notes`, the page importing `{ lib }` from `linked-notes/lib.ts`: one E1013 at the specifier's opening quote, `E1013 'linked-notes/lib.ts' reaches modules/notes/lib.ts by an alias; import it as '../notes/lib.ts'`; after its fix the line reads `import { lib } from '../notes/lib.ts'` and `keel check` reports no E1013. `keel build` of it exits 1 with that E1013, no E1011, and nothing written."
// Seed 1337 (no random input: one fixed project). The project is the client tree of boundary-support.ts (node module `a`, client module `w`) with a symlink `node_modules/linked-a` to `modules/a` and a page of `w` importing `linked-a/helper.ts`.
// Reading: "nothing written" is no `dist/` folder after the build.
import { existsSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { SLOW, built, clientTree, keelRun, recordsOf, withFiles } from "./boundary-support.ts";
import { inProject } from "./bundle-support.ts";

const aliased = () =>
  withFiles(clientTree(), {
    "modules/w/View.tsx":
      "import { Box, Link } from '@keel/ui'\nimport { helper } from 'linked-a/helper.ts'\nimport { w } from './w.contract.ts'\n" +
      "export default function View() {\n  return (\n    <Box as=\"main\">\n      <Link to={w.href('w.login')}>{helper('x')}</Link>\n    </Box>\n  )\n}\n",
  });

describe("k.bundle Aliases: E1013 is a check error, so `keel build` stops at its check step", () => {
  test(
    "`keel check` of the project reports one E1013 for `linked-a/helper.ts`",
    async () => {
      await inProject(aliased(), (dir) => {
        symlinkSync(join(dir, "modules", "a"), join(dir, "node_modules", "linked-a"));
        const r = keelRun(dir, ["check"]);
        const hits = recordsOf(r.out, "E1013");
        expect(hits).toHaveLength(1);
        expect(hits[0]).toContain(
          "'linked-a/helper.ts' reaches modules/a/helper.ts by an alias; import it as '../a/helper.ts'",
        );
      });
    },
    SLOW,
  );

  test(
    "`keel build` of it exits 1 with that E1013, no E1011, and nothing written",
    async () => {
      await inProject(aliased(), (dir) => {
        symlinkSync(join(dir, "modules", "a"), join(dir, "node_modules", "linked-a"));
        const r = built(dir);
        expect(r.status, r.out).toBe(1);
        expect(recordsOf(r.out, "E1013")).toHaveLength(1);
        expect(recordsOf(r.out, "E1011")).toEqual([]);
        expect(existsSync(join(dir, "dist"))).toBe(false);
      });
    },
    SLOW,
  );
});
