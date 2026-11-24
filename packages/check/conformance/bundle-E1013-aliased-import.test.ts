// Seed 1337 (the property below)
// Spec: k.bundle, Rules "E1013 a specifier other than relative reaching a file under `modules/`, in `keel check` (fix: the relative specifier; Aliases)"
// Spec: k.bundle, Aliases "A file under the project's `modules/` is imported by a relative specifier. `keel check` resolves every other specifier of an `import`, `import type`, `export … from` or `import('<literal>')` in a code file of the project outside `node_modules/`, its `?query` stripped, as its type check does: bundler resolution, a package's `exports` and `imports`, `node_modules` up from the file, symlinks followed to the real path, no `tsconfig.json` read. One that resolves to a file under `modules/` is E1013 at its opening quote: `E1013 '<specifier>' reaches modules/<id>/<path> by an alias; import it as '<relative>'`, `<relative>` the path from the importing file's folder to that file as named on disk, starting `./` or `../`, the query appended. The fix replaces the specifier with `<relative>`. By form:"
// Spec: k.bundle, Aliases "a package `imports` entry (`#notes/lib.ts`), a package reached through a workspace link or a `node_modules` symlink, or the project's own name through its `exports`, landing under `modules/`: E1013."
// Spec: k.bundle, Aliases "a `tsconfig.json` `paths` or `baseUrl` alias (`@/notes/lib.ts`), a root-absolute `/modules/notes/lib.ts`, a Vite `resolve.alias`: no file resolves, so one E1751 whose message starts `TS2307`, and no E1013."
// Spec: k.bundle, Aliases "a specifier resolving outside `modules/` (`@keel/ui`, `#lib/x.ts` to `./lib/x.ts`): nothing."
// Spec: k.bundle, Aliases "A build reports no E1013; an alias reaching a module the map omits is E1011 there."
// Spec: k.bundle, Conformance "`keel check` of that fixture with `"imports": { "#notes/*": "./modules/notes/*" }` in its `package.json`, the page importing `{ lib }` from `#notes/lib.ts`: one E1013 at the specifier's opening quote, `E1013 '#notes/lib.ts' reaches modules/notes/lib.ts by an alias; import it as '../notes/lib.ts'`; after its fix the line reads `import { lib } from '../notes/lib.ts'` and `keel check` reports no E1013."
// Spec: k.bundle, Conformance "In that project, one E1013 each, its fix `'../notes/T.ts'` or `'../notes/lib.ts'`, for `import type { T } from '#notes/T.ts'`, `export { lib } from '#notes/lib.ts'`, `import('#notes/lib.ts')`, and `linked-notes/lib.ts` through a symlink `node_modules/linked-notes` to `modules/notes`; with `"#app/*": "./modules/app/*"` added, `#app/Page.tsx` imported from `modules/app/sub/Deep.tsx` is one E1013 whose fix is `'../Page.tsx'`."
// Spec: k.bundle, Conformance "In that project, with `tsconfig.json` `paths: { "@/*": ["./modules/*"] }`, an import of `@/notes/lib.ts` is one E1751 whose message starts `TS2307` and no E1013, as is one of `/modules/notes/lib.ts`; with `"#lib/*": "./lib/*"` and a file `lib/x.ts`, an import of `#lib/x.ts` is neither; `keel build` of the project with `#notes/lib.ts` prints no E1013."
// The project is a real tree (E1013-support.ts): `package.json` `imports` and `exports`, symlinks in `node_modules`, a `tsconfig.json` with `paths`. `check(files, { root })` gets the same files in memory. The
// spec's "that fixture" is read as the Aliases-section project: modules `app` (page `modules/app/Page.tsx`, deps `notes`) and `notes` (public `lib`, `T`). The page of every case is named `Page.tsx`.
// Reading: the diagnostic's `message` is the text after the code, `'<specifier>' reaches ...`; the fix is the unified diff `--- a/<path>` `+++ b/<path>` with one `-` and one `+` line.
// Reading: a Vite `resolve.alias` is not testable through `check` (it reads no Vite config); it is covered by the same no-resolution path as `paths`. The cli case "`keel build` reports no E1013" is in packages/cli/conformance/bundle-E1013-build.test.ts.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { check } from "@keel/check";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { BASE, writeProject } from "./E1013-support.ts";
import type { Files } from "./support.ts";
import { SEED } from "./support.ts";

let dir = "";
let root = "";
beforeAll(() => {
  dir = mkdtempSync(join(realpathSync(tmpdir()), "keel-e1013-"));
  writeProject(dir, BASE);
  root = join(dir, sep);
});
afterAll(() => {
  if (dir !== "") rmSync(dir, { recursive: true, force: true });
});

const f = (path: string, source: string): Files[number] => ({ path, source });
const PAGE = "modules/app/Page.tsx";
/** The project's files with `extra` added or replacing. */
const withFiles = (...extra: Files): Files => [...BASE.filter((b) => !extra.some((e) => e.path === b.path)), ...extra];
const run = (files: Files) => check(files, { root }).diagnostics;
const only = (files: Files, code: string) => run(files).filter((d) => d.code === code);
/** A fresh copy of `files` in a temp folder with `diff` applied by `git apply`; the source of `path` after. */
function patched(files: Files, diff: string, path: string): string {
  const tmp = mkdtempSync(join(realpathSync(tmpdir()), "keel-e1013-fix-"));
  try {
    for (const file of files) {
      mkdirSync(dirname(join(tmp, file.path)), { recursive: true });
      writeFileSync(join(tmp, file.path), file.source);
    }
    writeFileSync(join(tmp, "fix.patch"), `${diff}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: tmp, stdio: "pipe" });
    return readFileSync(join(tmp, path), "utf8");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
const changedLines = (diff: string): string[] =>
  diff
    .split("\n")
    .filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"));

describe("k.bundle Aliases: `#notes/lib.ts` in the page, `keel check` of the project", () => {
  const source = "import { lib } from '#notes/lib.ts'\nexport const x = lib\n";
  const files = withFiles(f(PAGE, source));

  test("is one E1013 at `modules/app/Page.tsx`", () => {
    const d = only(files, "E1013");
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe(PAGE);
  });

  test("the E1013 is at the specifier's opening quote: line 1, column 21", () => {
    const d = only(files, "E1013")[0];
    expect(d?.line).toBe(1);
    expect(d?.col).toBe(source.indexOf("'") + 1);
    expect(d?.col).toBe(21);
  });

  test("the message is `'#notes/lib.ts' reaches modules/notes/lib.ts by an alias; import it as '../notes/lib.ts'`", () => {
    expect(only(files, "E1013")[0]?.message).toBe(
      "'#notes/lib.ts' reaches modules/notes/lib.ts by an alias; import it as '../notes/lib.ts'",
    );
  });

  test("the fix replaces the specifier: one `-` and one `+` line of the diff, `--- a/modules/app/Page.tsx`", () => {
    const fix = only(files, "E1013")[0]?.fix ?? "";
    expect(fix.startsWith("--- a/modules/app/Page.tsx\n+++ b/modules/app/Page.tsx\n")).toBe(true);
    expect(changedLines(fix)).toEqual([
      "-import { lib } from '#notes/lib.ts'",
      "+import { lib } from '../notes/lib.ts'",
    ]);
  });

  test("after its fix the line reads `import { lib } from '../notes/lib.ts'` and `keel check` reports no E1013", () => {
    const fix = only(files, "E1013")[0]?.fix ?? "";
    const after = patched(files, fix, PAGE);
    expect(after.split("\n")[0]).toBe("import { lib } from '../notes/lib.ts'");
    expect(only(withFiles(f(PAGE, after)), "E1013")).toEqual([]);
  });

  test("the relative import `../notes/lib.ts` is no E1013", () => {
    expect(only(withFiles(f(PAGE, "import { lib } from '../notes/lib.ts'\nexport const x = lib\n")), "E1013")).toEqual(
      [],
    );
  });
});

describe("k.bundle Aliases: each form a package alias or link takes, landing under `modules/`", () => {
  const cases: readonly (readonly [string, string, string, string])[] = [
    [
      "`import type { T } from '#notes/T.ts'`",
      "import type { T } from '#notes/T.ts'\nexport type U = T\n",
      "#notes/T.ts",
      "../notes/T.ts",
    ],
    [
      "`export { lib } from '#notes/lib.ts'`",
      "export { lib } from '#notes/lib.ts'\n",
      "#notes/lib.ts",
      "../notes/lib.ts",
    ],
    ["`import('#notes/lib.ts')`", "export const p = import('#notes/lib.ts')\n", "#notes/lib.ts", "../notes/lib.ts"],
    [
      "`linked-notes/lib.ts` through a symlink `node_modules/linked-notes` to `modules/notes`",
      "import { lib } from 'linked-notes/lib.ts'\nexport const x = lib\n",
      "linked-notes/lib.ts",
      "../notes/lib.ts",
    ],
    [
      "`@fx/notes/lib.ts` through a relative workspace link",
      "import { lib } from '@fx/notes/lib.ts'\nexport const x = lib\n",
      "@fx/notes/lib.ts",
      "../notes/lib.ts",
    ],
    [
      "`fx/notes/lib.ts`, the project's own name through its `exports`",
      "import { lib } from 'fx/notes/lib.ts'\nexport const x = lib\n",
      "fx/notes/lib.ts",
      "../notes/lib.ts",
    ],
    [
      "`#notes/lib.ts?raw`, the query appended to the relative specifier",
      "import lib from '#notes/lib.ts?raw'\nexport const x = lib\n",
      "#notes/lib.ts?raw",
      "../notes/lib.ts?raw",
    ],
  ];
  for (const [name, source, specifier, relative] of cases) {
    test(`${name} in the page is one E1013 with the fix '${relative}'`, () => {
      const files = withFiles(f(PAGE, source));
      const d = only(files, "E1013");
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe(
        `'${specifier}' reaches modules/notes/${relative.slice("../notes/".length).replace(/\?.*$/, "")} by an alias; import it as '${relative}'`,
      );
      expect(changedLines(d[0]?.fix ?? "")).toEqual([
        `-${source.split("\n")[0]}`,
        `+${(source.split("\n")[0] ?? "").replace(`'${specifier}'`, `'${relative}'`)}`,
      ]);
    });
  }

  test("`#app/Page.tsx` imported from `modules/app/sub/Deep.tsx` is one E1013 whose fix is `'../Page.tsx'`", () => {
    const files = withFiles(
      f("modules/app/sub/Deep.tsx", "import { Page } from '#app/Page.tsx'\nexport const d = Page\n"),
    );
    const d = only(files, "E1013");
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("modules/app/sub/Deep.tsx");
    expect(d[0]?.message).toBe("'#app/Page.tsx' reaches modules/app/Page.tsx by an alias; import it as '../Page.tsx'");
    expect(changedLines(d[0]?.fix ?? "")).toEqual([
      "-import { Page } from '#app/Page.tsx'",
      "+import { Page } from '../Page.tsx'",
    ]);
  });

  test("an import into the file's own module, `#notes/lib.ts` from `modules/notes/more.ts`, is one E1013 whose fix is `'./lib.ts'`", () => {
    const files = withFiles(
      f("modules/notes/more.ts", "import { lib } from '#notes/lib.ts'\nexport const more = lib\n"),
    );
    const d = only(files, "E1013");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe("'#notes/lib.ts' reaches modules/notes/lib.ts by an alias; import it as './lib.ts'");
  });

  test("a test file is covered: `modules/app/test/page.test.ts` importing `#notes/lib.ts` is one E1013 whose fix is `'../../notes/lib.ts'`", () => {
    const files = withFiles(
      f("modules/app/test/page.test.ts", "import { lib } from '#notes/lib.ts'\nexport const t = lib\n"),
    );
    const d = only(files, "E1013");
    expect(d).toHaveLength(1);
    expect(d[0]?.path).toBe("modules/app/test/page.test.ts");
    expect(d[0]?.message).toBe(
      "'#notes/lib.ts' reaches modules/notes/lib.ts by an alias; import it as '../../notes/lib.ts'",
    );
  });

  test("a test file of the module itself is covered: `modules/notes/test/lib.test.ts` importing `#notes/lib.ts` has the fix `'../lib.ts'`", () => {
    const files = withFiles(
      f("modules/notes/test/lib.test.ts", "import { lib } from '#notes/lib.ts'\nexport const t = lib\n"),
    );
    const d = only(files, "E1013");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe("'#notes/lib.ts' reaches modules/notes/lib.ts by an alias; import it as '../lib.ts'");
  });

  test("a file outside `modules/` is checked too: `lib/y.ts` importing `#notes/lib.ts` is one E1013 whose fix is `'../modules/notes/lib.ts'`", () => {
    const files = withFiles(f("lib/y.ts", "import { lib } from '#notes/lib.ts'\nexport const y = lib\n"));
    const d = only(files, "E1013");
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe(
      "'#notes/lib.ts' reaches modules/notes/lib.ts by an alias; import it as '../modules/notes/lib.ts'",
    );
  });
});

describe("k.bundle Aliases: no E1013 where no file resolves under `modules/`", () => {
  const e1751 = (files: Files) => only(files, "E1751").filter((d) => d.message.startsWith("TS2307"));

  test("`@/notes/lib.ts` through a `tsconfig.json` `paths` alias is one E1751 whose message starts `TS2307` and no E1013", () => {
    const files = withFiles(f(PAGE, "import { lib } from '@/notes/lib.ts'\nexport const x = lib\n"));
    expect(e1751(files)).toHaveLength(1);
    expect(only(files, "E1751")).toHaveLength(1);
    expect(only(files, "E1013")).toEqual([]);
  });

  test("`/modules/notes/lib.ts`, root-absolute, is one E1751 whose message starts `TS2307` and no E1013", () => {
    const files = withFiles(f(PAGE, "import { lib } from '/modules/notes/lib.ts'\nexport const x = lib\n"));
    expect(e1751(files)).toHaveLength(1);
    expect(only(files, "E1751")).toHaveLength(1);
    expect(only(files, "E1013")).toEqual([]);
  });

  test("`#lib/x.ts` to `./lib/x.ts` is neither E1751 nor E1013", () => {
    const files = withFiles(f(PAGE, "import { x } from '#lib/x.ts'\nexport const y = x\n"));
    expect(only(files, "E1751")).toEqual([]);
    expect(only(files, "E1013")).toEqual([]);
  });

  test("a specifier of a package outside `modules/` (`vitest`) is no E1013", () => {
    const files = withFiles(f(PAGE, "import { test } from 'vitest'\nexport const y = test\n"));
    expect(only(files, "E1013")).toEqual([]);
  });
});

describe("k.bundle Rules: E1013 over alias forms, depths and statements", () => {
  type Form = { readonly spec: string; readonly target: string };
  const forms: readonly Form[] = [
    { spec: "#notes/lib.ts", target: "modules/notes/lib.ts" },
    { spec: "linked-notes/lib.ts", target: "modules/notes/lib.ts" },
    { spec: "@fx/notes/lib.ts", target: "modules/notes/lib.ts" },
    { spec: "fx/notes/lib.ts", target: "modules/notes/lib.ts" },
    { spec: "#app/Page.tsx", target: "modules/app/Page.tsx" },
  ];
  const statements: readonly ((spec: string) => string)[] = [
    (s) => `import { v } from '${s}'\nexport const w = v\n`,
    (s) => `import type * as N from '${s}'\nexport type W = typeof N\n`,
    (s) => `export { x } from '${s}'\n`,
    (s) => `export const p = import('${s}')\n`,
  ];
  const upTo = (depth: number, target: string): string => {
    const from = ["modules", "app", ...Array.from({ length: depth }, (_, i) => `s${i}`)];
    const to = target.split("/");
    let common = 0;
    while (common < from.length && common < to.length - 1 && from[common] === to[common]) common += 1;
    const ups = from.length - common;
    return `${ups === 0 ? "./" : "../".repeat(ups)}${to.slice(common).join("/")}`;
  };

  test("property: any alias form from any depth under `modules/app`, in any statement, is one E1013 at the opening quote whose fix writes the relative path", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...forms),
        fc.nat({ max: 3 }),
        fc.constantFrom(...statements),
        fc.nat({ max: 2 }),
        (form, depth, statement, blank) => {
          const path = `modules/app/${Array.from({ length: depth }, (_, i) => `s${i}/`).join("")}Deep.ts`;
          const source = `${"\n".repeat(blank)}${statement(form.spec)}`;
          const files = withFiles(f(path, source));
          const d = only(files, "E1013");
          const relative = upTo(depth, form.target);
          expect(d).toHaveLength(1);
          expect(d[0]?.path).toBe(path);
          expect(d[0]?.line).toBe(blank + 1);
          const first = source.split("\n")[blank] ?? "";
          expect(d[0]?.col).toBe(first.indexOf("'") + 1);
          expect(d[0]?.message).toBe(`'${form.spec}' reaches ${form.target} by an alias; import it as '${relative}'`);
          expect(relative.startsWith("./") || relative.startsWith("../")).toBe(true);
          const after = patched(files, d[0]?.fix ?? "", path);
          expect(after).toBe(source.replace(`'${form.spec}'`, `'${relative}'`));
        },
      ),
      { seed: SEED, numRuns: 60 },
    );
  });

  test("property: the same import written with the relative specifier is no E1013", () => {
    fc.assert(
      fc.property(fc.nat({ max: 3 }), fc.constantFrom(...statements), (depth, statement) => {
        const path = `modules/app/${Array.from({ length: depth }, (_, i) => `s${i}/`).join("")}Deep.ts`;
        const files = withFiles(f(path, statement(upTo(depth, "modules/notes/lib.ts"))));
        expect(only(files, "E1013")).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
