// Spec: k.contract, clause "In a fixture whose `node` deployable `api` serves module `a`, `local: !0`, `local: on` with `const on = true`, and `local: flag ? true : true` on page `a.tools` are each one E1510 at `local` in `keel check` and in `keel build`; after a `keel build` that succeeds, one that then fails with that E1510 leaves no `dist/api/`, and one that fails with the E1511 above no `dist/web/`."
// Rule text (not a Conformance bullet, so not a citation): E1510: k.contract; for a `local` member other than the literal `true` (`!0`, a name bound to `true`, a conditional), at that member in `keel check` and `keel build`. A `keel build` that fails with E1511 or E1510 leaves no `dist/<name>/` of the deployable serving the entry.
// This file covers the `keel check` half (`check()` of `@keel/check`, in-memory project, the topology as an option as local-routes-no-server.test.ts passes it); the `keel build` half and the `dist/` halves are packages/cli's local-routes-literal-true-build.test.ts. Seed 1337 (the page's path).
// ASSUMED: "at `local`" is the diagnostic's `line` being the line of the `local` member, its `col` within that member (from the key to the end of its value).
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Files, SEED } from "./support.ts";

const HEAD = "import { contract } from '@keel/router/contract'\nconst on = true\ndeclare const flag: boolean\n";
const project = (expr: string, path = "/tools"): { files: Files; line: number; col: number; width: number } => {
  const member = `local: ${expr}`;
  const source = `${HEAD}export const a = contract('a', {\n  'a.tools': { path: '${path}', ${member} },\n})\n`;
  const lines = source.split("\n");
  const line = lines.findIndex((l) => l.includes(member)) + 1;
  const col = (lines[line - 1] ?? "").indexOf(member) + 1;
  return {
    files: [
      {
        path: "modules/a/module.ts",
        source:
          "import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: [], capabilities: [], public: { exports: [] } })\n",
      },
      { path: "modules/a/a.contract.ts", source },
    ],
    line,
    col,
    width: member.length,
  };
};
const e1510 = (files: Files) =>
  check(files, { types: false, topology: { api: { modules: ["a"], adapter: "node" } } }).diagnostics.filter(
    (d) => d.code === "E1510",
  );

describe("k.contract Local routes: `local` other than the literal `true` is E1510 in `keel check`", () => {
  for (const expr of ["!0", "on", "flag ? true : true"]) {
    it(`\`local: ${expr}\` on page \`a.tools\` in a fixture whose \`node\` deployable \`api\` serves module \`a\` is one E1510 at \`local\` in \`keel check\``, () => {
      const p = project(expr);
      const d = e1510(p.files);
      expect(d).toHaveLength(1);
      expect(d[0]?.path).toBe("modules/a/a.contract.ts");
      expect(d[0]?.line).toBe(p.line);
      expect(d[0]?.col).toBeGreaterThanOrEqual(p.col);
      expect(d[0]?.col).toBeLessThan(p.col + p.width);
    });
  }

  it("the literal `true` is no E1510, whatever the page's path", () => {
    const seg = fc.stringMatching(/^[a-z]{1,8}$/);
    fc.assert(
      fc.property(fc.array(seg, { minLength: 1, maxLength: 3 }), (segs) => {
        expect(e1510(project("true", `/${segs.join("/")}`).files)).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
