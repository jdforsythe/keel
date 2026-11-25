// k.boundary, Following "Reach, and k.origins' file importing another, follow a specifier to the project file k.bundle Aliases resolves it to (relative, the project's own name, a workspace link or a `node_modules` symlink whose real path is a project file), its query stripped; one resolving under `node_modules/` or outside the project is a package's, not followed (E1007 holds at build). An `import()` of a template literal whose text before its first substitution starts `./` or `../` reaches each project file its pattern matches, each substitution read as `*` within one path segment, as Vite expands it; any other non-literal `import()` (W1608) reaches nothing, and E1007 holds at build. E1015 is a relative specifier in a non-test project code file that resolves to a file outside the project root: `keel check` reads only the project's files, so no rule follows it; shared code is a package. Message `'<specifier>' resolves outside the project; check reads only its files`, the specifier cut from its front to fit 89 units (59 without it); no fix."
// k.boundary, Reach "Client-reachable code (E1004, E1571 and E1107), with a `topology.ts`: a file under `modules/<id>/`, not server-only, of a `node` or `static` module (one such a deployable lists); a file of a `client` module, for imports of another module's server-only files; and a project file outside `node_modules/` a client entry reaches by value imports, re-exports and `import()` (Following), not through a server-only file. Client entries: each route `component` of a `node` or `static` module and every file of a `client` one. No `topology.ts`: every file but server-only ones. A `routes.ts` may import server-only files by value; a specifier with a query names its file; package imports are not followed (E1007 covers them). An E1004 found through a chain ends `(<entry> -> … -> <file>)`."
// Spec: k.boundary, clause "In a `node` fixture whose `package.json` is `{\"name\":\"p\",\"type\":\"module\",\"exports\":{\"./*\":\"./*\"}}`, a route component importing `p/lib/fmt.ts`, where `lib/fmt.ts` imports `./keys.server.ts`, is one E1004 at that import in `lib/fmt.ts`; a route component calling `` import(`../../lib/p/${n}.ts`) ``, where `lib/p/x.ts` imports `../keys.server.ts`, is one E1004 at that import in `lib/p/x.ts`; with `import(name)` in its place, `name` a parameter, no E1004 is reported in `lib/p/x.ts`."
// Seed 1337 (the properties below). Each project is a temporary root holding the files and a `package.json`; `check(files, { root })` gets the same files in memory, as the E1013 suite does. The type pass is off.
// Reading: "at that import" is the diagnostic's path and line; E1004 sits in the importing file (k.boundary E1004's message).
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CONTRACT_A, ROUTES_A, file, nodeA } from "./boundary-support.ts";
import { freshDir, linkAt, removeDir, rootOption, writeFileAt, writeTree } from "./security-support.ts";
import { type Files, SEED } from "./support.ts";

const PKG = '{"name":"p","type":"module","exports":{"./*":"./*"}}\n';
const KEYS = file("lib/keys.server.ts", "export const key = 'k'\n");
const route = (page: string): Files => nodeA([ROUTES_A, CONTRACT_A, file("modules/a/Page.tsx", page)]);

/** Checks `files` in a project root holding them, `package.json` and the `links` (`node_modules` path to a project-relative target). */
function run(files: Files, links: Record<string, string> = {}, pkg: string = PKG) {
  const dir = freshDir("keel-follow");
  try {
    writeTree(dir, files);
    writeFileAt(dir, "package.json", pkg);
    for (const [at, target] of Object.entries(links)) linkAt(dir, at, target);
    return check(files, { root: rootOption(dir), types: false }).diagnostics;
  } finally {
    removeDir(dir);
  }
}
const e1004 = (ds: ReturnType<typeof run>) => ds.filter((d) => d.code === "E1004");
const PAGE_OWN = "import { fmt } from 'p/lib/fmt.ts'\nexport default function Page() {\n  return fmt('x')\n}\n";
const FMT = file(
  "lib/fmt.ts",
  "import { key } from './keys.server.ts'\nexport const fmt = (x: string): string => x + key\n",
);

describe("k.boundary Following: Reach follows the project's own name, a link, and a template import()", () => {
  test('in a `node` fixture whose `package.json` is `{"name":"p","type":"module","exports":{"./*":"./*"}}`, a route component importing `p/lib/fmt.ts`, where `lib/fmt.ts` imports `./keys.server.ts`, is one E1004 at that import in `lib/fmt.ts`', () => {
    const ds = e1004(run([...route(PAGE_OWN), FMT, KEYS]));
    expect(ds).toHaveLength(1);
    expect(ds[0]?.path).toBe("lib/fmt.ts");
    expect(ds[0]?.line).toBe(1);
    expect(ds[0]?.message.endsWith("lib/keys.server.ts)")).toBe(true);
  });

  test("a route component calling `` import(`../../lib/p/${n}.ts`) ``, where `lib/p/x.ts` imports `../keys.server.ts`, is one E1004 at that import in `lib/p/x.ts`", () => {
    const page =
      "export default function Page() {\n  return null\n}\nexport const lazy = (n: string) => import(`../../lib/p/${n}.ts`)\n";
    const x = file("lib/p/x.ts", "import { key } from '../keys.server.ts'\nexport const x = key\n");
    const ds = e1004(run([...route(page), x, KEYS]));
    expect(ds).toHaveLength(1);
    expect(ds[0]?.path).toBe("lib/p/x.ts");
    expect(ds[0]?.line).toBe(1);
  });

  test("with `import(name)` in its place, `name` a parameter, no E1004 is reported in `lib/p/x.ts`", () => {
    const page =
      "export default function Page() {\n  return null\n}\nexport const lazy = (name: string) => import(name)\n";
    const x = file("lib/p/x.ts", "import { key } from '../keys.server.ts'\nexport const x = key\n");
    expect(e1004(run([...route(page), x, KEYS])).filter((d) => d.path === "lib/p/x.ts")).toEqual([]);
  });

  test("property: the same file reached by a relative specifier, the project's own name or a `node_modules` symlink to its folder is one E1004 in it, whichever spelling the route component uses", () => {
    const spelling = fc.constantFrom("../../lib/fmt.ts", "p/lib/fmt.ts", "linked-lib/fmt.ts", "p/lib/../lib/fmt.ts");
    fc.assert(
      fc.property(spelling, fc.constantFrom("import", "export-from", "dynamic"), (spec, how) => {
        const body =
          how === "import"
            ? `import { fmt } from '${spec}'\nexport default function Page() {\n  return fmt('x')\n}\n`
            : how === "export-from"
              ? `export { fmt } from '${spec}'\nexport default function Page() {\n  return null\n}\n`
              : `export default function Page() {\n  return null\n}\nexport const lazy = () => import('${spec}')\n`;
        const ds = e1004(run([...route(body), FMT, KEYS], { "node_modules/linked-lib": "../lib" }));
        expect(ds.map((d) => d.path)).toEqual(["lib/fmt.ts"]);
      }),
      { seed: SEED, numRuns: 24 },
    );
  });

  test("an `import()` template whose head is `./` or `../` reaches each file its pattern matches, each substitution read as `*` within one path segment", () => {
    const lib = (name: string, up: string) =>
      file(name, `import { key } from '${up}keys.server.ts'\nexport const v = key\n`);
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,6}$/), (name) => {
        const page =
          "export default function Page() {\n  return null\n}\nexport const lazy = (n: string) => import(`../../lib/p/${n}.ts`)\n";
        const ds = e1004(
          run([...route(page), lib(`lib/p/${name}.ts`, "../"), lib(`lib/p/deeper/${name}.ts`, "../../"), KEYS]),
        );
        expect(ds.map((d) => d.path)).toEqual([`lib/p/${name}.ts`]);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("two substitutions are two segments: `` import(`../../lib/${a}/${b}.ts`) `` reaches `lib/p/x.ts` and not `lib/p/q/x.ts`", () => {
    const page =
      "export default function Page() {\n  return null\n}\nexport const lazy = (a: string, b: string) => import(`../../lib/${a}/${b}.ts`)\n";
    const mk = (name: string, up: string) =>
      file(name, `import { key } from '${up}keys.server.ts'\nexport const v = key\n`);
    const ds = e1004(run([...route(page), mk("lib/p/x.ts", "../"), mk("lib/p/q/x.ts", "../../"), KEYS]));
    expect(ds.map((d) => d.path)).toEqual(["lib/p/x.ts"]);
  });

  test("any other non-literal `import()` reaches nothing: a template with no `./` or `../` head, a bare head, a head that is a substitution, a concatenation, a variable", () => {
    const x = file("lib/p/x.ts", "import { key } from '../keys.server.ts'\nexport const x = key\n");
    const heads = [
      "import(`${n}.ts`)",
      "import(`lib/p/${n}.ts`)",
      "import(`p/lib/p/${n}.ts`)",
      "import('../../lib/p/' + n)",
      "import(n)",
      "import(`/lib/p/${n}.ts`)",
    ];
    for (const call of heads) {
      const page = `export default function Page() {\n  return null\n}\nexport const lazy = (n: string) => ${call}\n`;
      expect(e1004(run([...route(page), x, KEYS])).filter((d) => d.path === "lib/p/x.ts")).toEqual([]);
    }
  });

  test("a specifier resolving under `node_modules/` or outside the project is a package's: not followed, so a server-only file it holds is no E1004 in check", () => {
    const page = "import { v } from 'some-pkg'\nexport default function Page() {\n  return v\n}\n";
    const pkgDir = "node_modules/some-pkg";
    const dir = freshDir("keel-follow-pkg");
    try {
      const files = [...route(page), KEYS];
      writeTree(dir, files);
      writeFileAt(dir, "package.json", PKG);
      writeFileAt(dir, `${pkgDir}/package.json`, '{"name":"some-pkg","version":"1.0.0","main":"index.js"}\n');
      writeFileAt(dir, `${pkgDir}/index.js`, "export const v = 1\n");
      const ds = check(files, { root: rootOption(dir), types: false }).diagnostics;
      expect(e1004(ds)).toEqual([]);
      expect(ds.filter((d) => d.code === "E1015")).toEqual([]);
    } finally {
      removeDir(dir);
    }
  });
});
