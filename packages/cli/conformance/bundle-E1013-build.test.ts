// Spec: k.bundle, Aliases "A build reports no E1013; an alias reaching a module the map omits is E1011 there."
// Spec: k.bundle, Conformance "In that project, with `tsconfig.json` `paths: { "@/*": ["./modules/*"] }`, an import of `@/notes/lib.ts` is one E1751 whose message starts `TS2307` and no E1013, as is one of `/modules/notes/lib.ts`; with `"#lib/*": "./lib/*"` and a file `lib/x.ts`, an import of `#lib/x.ts` is neither; `keel build` of the project with `#notes/lib.ts` prints no E1013."
// Seed 1337 (no random input: one fixed project). The project is the client tree of boundary-support.ts (node module `a`, client module `w`) with a `package.json` `imports` entry `#a/*` for `modules/a/*` and a page of `w` importing `#a/helper.ts`.
// Reading: "an alias reaching a module the map omits is E1011 there" is asserted as written, though k.boundary's Build gate runs `keel check` first and the alias is E1013 there (reported as a spec contradiction); only the absence of E1013 is the clause under test.
import { describe, expect, test } from "vitest";
import { SLOW, built, clientTree, keelRun, recordsOf, withFiles } from "./boundary-support.ts";
import { inProject } from "./bundle-support.ts";

const aliased = () =>
  withFiles(clientTree(), {
    "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", imports: { "#a/*": "./modules/a/*" } })}\n`,
    "modules/w/View.tsx":
      "import { Box, Link } from '@keel/ui'\nimport { helper } from '#a/helper.ts'\nimport { w } from './w.contract.ts'\n" +
      "export default function View() {\n  return (\n    <Box as=\"main\">\n      <Link to={w.href('w.login')}>{helper('x')}</Link>\n    </Box>\n  )\n}\n",
  });

describe("k.bundle Aliases: a build reports no E1013", () => {
  test(
    "`keel build` of the project whose client page imports `#a/helper.ts` prints no E1013",
    async () => {
      await inProject(aliased(), (dir) => {
        const r = built(dir);
        expect(recordsOf(r.out, "E1013")).toEqual([]);
      });
    },
    SLOW,
  );

  test(
    "an alias reaching a module the map omits is E1011 in the build: `keel build` exits 1 with one E1011 for `a`",
    async () => {
      await inProject(aliased(), (dir) => {
        const r = built(dir);
        expect(r.status, r.out).toBe(1);
        const hits = recordsOf(r.out, "E1011");
        expect(hits).toHaveLength(1);
        expect(hits[0]).toContain("a is not in the client's service map: imported by modules/w/View.tsx");
      });
    },
    SLOW,
  );

  test(
    "`keel check` of the same project does report the alias as E1013 (the check reports it, the build does not)",
    async () => {
      await inProject(aliased(), (dir) => {
        const r = keelRun(dir, ["check"]);
        expect(recordsOf(r.out, "E1013")).toHaveLength(1);
      });
    },
    SLOW,
  );
});
