// Spec: k.origins, Rules "E1570 and E1571 (k.security) do not report a URL whose origin is declared under its directive on each deployable listing the module that holds the file or a file importing it, directly or not (none: every deployable). Importing follows k.boundary Following. They read a URL as written: a string literal, a template's text before its first substitution, the left side of `+`, `new URL` and `new Request`, through `const`s and imports; one computed otherwise is not reported. The policy, not the check, blocks an undeclared origin: a URL the check misses fails in the browser with a `csp` report (k.security Reports), never past the policy. Directives: `img` for `Image src`, `src` and `srcset` of `img`, `srcset` of `source`, `poster`; `media` for `src` of `video`, `audio`, `source`, `track`; `frame` for `Frame src` and `iframe src`; `connect` for E1571. A `srcset` is one E1570 if any absolute candidate is undeclared. `data`, `action` and `formaction` stay E1570. E1570 reports a literal `Frame src` that is not absolute, and reads `\\` as `/` (`/\\host`)"
// Spec: k.origins, Conformance "`Image src=\"https://a.example/x.png\"` in `lib/pic.tsx`, outside every module, imported by `modules/a/Page.tsx` as `../../lib/pic.tsx` and by `modules/b/Page.tsx` as `p/lib/pic.tsx` (the project's own name), with only `a`'s deployable declaring `img` `https://a.example`, is one E1570."
// Seed 1337 (the properties below). Each project is a temporary root holding the files, `package.json` `{"name":"p","type":"module","exports":{"./*":"./*"}}` and a `node_modules` link; `check(files, { root })` gets the same files in memory. The type pass is off.
// Reading: "imported by" counts a value import, a re-export and an `import()` (k.boundary Following), directly or through other files.
// Untestable here: "The policy, not the check, blocks an undeclared origin: a URL the check misses fails in the browser with a `csp` report" is the browser's and k.security Reports' (a unit of the served policy); the check half is the "one computed otherwise is not reported" cases below.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { type Deployable, decl, project } from "./origins-support.ts";
import { freshDir, linkAt, removeDir, rootOption, writeFileAt, writeTree } from "./security-support.ts";
import { type Files, SEED } from "./support.ts";

const PKG = '{"name":"p","type":"module","exports":{"./*":"./*"}}\n';
const f = (path: string, source: string): Files[number] => ({ path, source });
const PIC = f(
  "lib/pic.tsx",
  'import { Image } from \'@keel/ui\'\nexport default function Pic() { return <Image src="https://a.example/x.png" alt="x" /> }\n',
);
const importer = (
  id: string,
  spec: string,
  how: "import" | "export" | "dynamic" | "template" = "import",
): Files[number] => {
  const body =
    how === "import"
      ? `import Pic from '${spec}'\nexport default function Page() { return Pic() }\n`
      : how === "export"
        ? `export { default as Pic } from '${spec}'\nexport default function Page() { return null }\n`
        : how === "dynamic"
          ? `export default function Page() { return null }\nexport const lazy = () => import('${spec}')\n`
          : `export default function Page() { return null }\nexport const lazy = (n: string) => import(\`${spec}\`)\n`;
  return f(`modules/${id}/Page.tsx`, body);
};
const IMG_A = decl("img", "https://a.example");

function run(files: Files, code: string) {
  const dir = freshDir("keel-origins");
  try {
    writeTree(dir, files);
    writeFileAt(dir, "package.json", PKG);
    linkAt(dir, "node_modules/linked-lib", "../lib");
    return check(files, { root: rootOption(dir), types: false }).diagnostics.filter((d) => d.code === code);
  } finally {
    removeDir(dir);
  }
}
const two = (a: string | undefined, b: string | undefined, files: Files): Files => {
  const deployables: Deployable[] = [
    { name: "wa", modules: ["a"], ...(a === undefined ? {} : { origins: a }) },
    { name: "wb", modules: ["b"], ...(b === undefined ? {} : { origins: b }) },
  ];
  return project(deployables, files);
};

describe("k.origins Rules: a file importing another is followed as k.boundary Following says", () => {
  test("`Image src=\"https://a.example/x.png\"` in `lib/pic.tsx`, outside every module, imported by `modules/a/Page.tsx` as `../../lib/pic.tsx` and by `modules/b/Page.tsx` as `p/lib/pic.tsx` (the project's own name), with only `a`'s deployable declaring `img` `https://a.example`, is one E1570", () => {
    const files = two(IMG_A, undefined, [PIC, importer("a", "../../lib/pic.tsx"), importer("b", "p/lib/pic.tsx")]);
    const ds = run(files, "E1570");
    expect(ds).toHaveLength(1);
    expect(ds[0]?.path).toBe("lib/pic.tsx");
  });

  test("property: however the second module imports `lib/pic.tsx` (a relative or own-name specifier, a link, an `export … from`, an `import()` literal or relative template, directly or through another file), the file is judged against both deployables: one E1570 until both declare the origin", () => {
    const how = fc.constantFrom(
      (t: string) => importer("b", `../../lib/${t}.tsx`),
      (t: string) => importer("b", `p/lib/${t}.tsx`),
      (t: string) => importer("b", `linked-lib/${t}.tsx`),
      (t: string) => importer("b", `p/lib/${t}.tsx`, "export"),
      (t: string) => importer("b", `p/lib/${t}.tsx`, "dynamic"),
      (t: string) => importer("b", `../../lib/${t}.tsx`, "dynamic"),
      (t: string) => importer("b", "../../lib/${n}.tsx", "template"),
    );
    fc.assert(
      fc.property(how, fc.boolean(), fc.boolean(), fc.boolean(), (make, mid, declA, declB) => {
        const bPage = make(mid ? "mid" : "pic");
        const extra: Files = mid ? [f("lib/mid.tsx", "export { default } from './pic.tsx'\n"), bPage] : [bPage];
        const files = two(declA ? IMG_A : undefined, declB ? IMG_A : undefined, [
          PIC,
          importer("a", "../../lib/pic.tsx"),
          ...extra,
        ]);
        expect(run(files, "E1570")).toHaveLength(declA && declB ? 0 : 1);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  test("a file imported by a module's file only through the project's own name is judged against that module's deployable alone when no other imports it", () => {
    const only = (decl_: string | undefined) => two(decl_, undefined, [PIC, importer("a", "p/lib/pic.tsx")]);
    expect(run(only(IMG_A), "E1570")).toEqual([]);
    expect(run(only(undefined), "E1570")).toHaveLength(1);
  });
});

describe("k.origins Rules: a URL is read as written", () => {
  const E1571_FILE = (expr: string): Files => [
    f(
      "modules/a/net.ts",
      `import type { Ctx } from '@keel/ctx'\nexport const get = (ctx: Ctx, base: string, path: string, buildUrl: () => string) => ctx.net.fetch(${expr})\n`,
    ),
  ];
  const one = (origins: string | undefined, files: Files): Files =>
    project([{ name: "web", modules: ["a"], ...(origins === undefined ? {} : { origins }) }], files);
  const CONNECT = decl("connect", "https://c.example");

  test("property: a string literal, a template's text before its first substitution, the left side of `+`, `new URL` and `new Request` each give the origin the check judges: E1571 when undeclared under `connect`, none when declared", () => {
    const exprs = fc.constantFrom(
      "'https://c.example/e'",
      "`https://c.example/${path}`",
      "'https://c.example/' + path",
      "new URL('https://c.example/e')",
      "new Request('https://c.example/e')",
      "new Request(`https://c.example/${path}`)",
      "new URL('https://c.example/' + path)",
    );
    fc.assert(
      fc.property(exprs, (expr) => {
        expect(run(one(undefined, E1571_FILE(expr)), "E1571")).toHaveLength(1);
        expect(run(one(decl("img", "https://c.example"), E1571_FILE(expr)), "E1571")).toHaveLength(1);
        expect(run(one(CONNECT, E1571_FILE(expr)), "E1571")).toEqual([]);
      }),
      { seed: SEED, numRuns: 14 },
    );
  });

  test("property: a URL read through a `const` of the file, or through a `const` imported from a project file, gives its origin as written", () => {
    const decls = fc.constantFrom(
      "export const U = 'https://c.example/e'",
      "export const U = `https://c.example/e`",
      "export const U = new URL('https://c.example/e')",
    );
    fc.assert(
      fc.property(decls, fc.boolean(), (d, imported) => {
        const files: Files = imported
          ? [
              f("modules/a/consts.ts", `${d}\n`),
              f(
                "modules/a/net.ts",
                "import type { Ctx } from '@keel/ctx'\nimport { U } from './consts.ts'\nexport const get = (ctx: Ctx) => ctx.net.fetch(U)\n",
              ),
            ]
          : [
              f(
                "modules/a/net.ts",
                `import type { Ctx } from '@keel/ctx'\n${d}\nexport const get = (ctx: Ctx) => ctx.net.fetch(U)\n`,
              ),
            ];
        expect(run(one(undefined, files), "E1571")).toHaveLength(1);
        expect(run(one(CONNECT, files), "E1571")).toEqual([]);
      }),
      { seed: SEED, numRuns: 12 },
    );
  });

  test("property: a URL computed otherwise (a call, a template or a `+` whose left side is not text, a parameter) is not reported, whatever origins are declared", () => {
    const exprs = fc.constantFrom(
      "buildUrl()",
      "`${base}/e`",
      "base + '/e'",
      "base",
      "String(path)",
      "new URL(path, base)",
      "new Request(buildUrl())",
    );
    fc.assert(
      fc.property(exprs, fc.constantFrom<string | undefined>(undefined, CONNECT), (expr, origins) => {
        expect(run(one(origins, E1571_FILE(expr)), "E1571")).toEqual([]);
      }),
      { seed: SEED, numRuns: 14 },
    );
  });
});
