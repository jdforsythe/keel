// k.boundary Following with k.library In an app: reach follows a specifier into `node_modules/` exactly when it is a
// listed library's `exports` entry, to the file it gives among the project's files, and nowhere else. The readers that
// follow a call agree: a client store's state built by a library's schema factory is read in the library's own files
// (k.privacy-reads Factories), and a library file's relative import leaving the project is E1015 as an app file's is.
import { expect, it } from "vitest";
import { check } from "../src/index.ts";
import { projectLibraries } from "../src/internal/projectLibraries.ts";
import { reachResolve } from "../src/internal/reachResolve.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";

const LIB = "node_modules/@acme/charts";
const manifest = (id: string, deps: string[], clientPii: string[] = []) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], clientPii: ${JSON.stringify(clientPii).replaceAll('"', "'")}, public: { exports: ['contact'] } })\n`;
const pkg = (keel: boolean): string =>
  JSON.stringify({
    name: "@acme/charts",
    version: "1.0.0",
    type: "module",
    ...(keel ? { keel: "library" } : {}),
    exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
  });
const FIELDS =
  "import { s } from '@keel/schema'\nconst mark = (max: number) => s.string({ max }).pii('contact')\nexport function contact(max: number) {\n  const field = mark(max)\n  return field\n}\n";
const page = (state: string): SourceFile => ({
  path: "modules/shop/Page.tsx",
  source: `import { s } from '@keel/schema'\nimport { store } from '@keel/store'\nimport { contact } from '@acme/charts'\nexport const form = store(s.object({ ${state} }), {})\nexport default function Page() {\n  return null\n}\n`,
});
const project = (opts: { keel?: boolean; clientPii?: string[]; files?: SourceFile[] } = {}): SourceFile[] => [
  { path: "modules/shop/module.ts", source: manifest("shop", ["@acme/charts"], opts.clientPii) },
  { path: `${LIB}/package.json`, source: pkg(opts.keel ?? true) },
  { path: `${LIB}/module.ts`, source: manifest("charts", []) },
  { path: `${LIB}/src/index.ts`, source: "export { contact } from './fields.ts'\n" },
  { path: `${LIB}/src/fields.ts`, source: FIELDS },
  ...(opts.files ?? []),
];
const hits = (code: string, files: SourceFile[]) =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === code)
    .map((d) => ({ path: d.path, message: d.message }));

it("a client store whose state a listed library's schema factory builds is read in the library's files", () => {
  expect(hits("E1107", project({ files: [page("e: contact(40)")] }))).toEqual([
    { path: "modules/shop/Page.tsx", message: "store state reaching #k-state holds .pii('contact'), not in clientPii" },
  ]);
  expect(hits("E1107", project({ clientPii: ["contact"], files: [page("e: contact(40)")] }))).toEqual([]);
});

it("the same package that is no library is not read from the project's files: its factory stays not readable", () => {
  const got = hits("E1107", project({ keel: false, files: [page("e: contact(40)")] }));
  expect(got).toHaveLength(1);
  expect(got[0]?.message).toContain("contact(");
  expect(got[0]?.message.endsWith("cannot show its .pii() classes")).toBe(true);
});

it("a library file's relative import that leaves the project is E1015 at the library's path, as an app file's is", () => {
  const out = `import x from '../../../../outside.ts'\nvoid x\n`;
  const lib = hits("E1015", project({ files: [{ path: `${LIB}/src/far.ts`, source: out }] }));
  const own = hits("E1015", project({ files: [{ path: "modules/charts/src/far.ts", source: out }] }));
  expect(own.map((h) => h.message)).toHaveLength(1);
  expect(lib).toEqual([{ path: `${LIB}/src/far.ts`, message: own[0]?.message }]);
});

it("reachResolve follows a listed library's entry to its file, never another specifier into node_modules/", () => {
  const files: SourceFile[] = [
    { path: "modules/shop/Page.tsx", source: "" },
    { path: "modules/charts/src/index.ts", source: "" },
    { path: "modules/charts/src/fields.ts", source: "" },
  ];
  const array: readonly SourceFile[] = Object.freeze([...files]);
  projectLibraries.set(array, {
    entries: new Map([
      ["@acme/charts", "modules/charts/src/index.ts"],
      ["@acme/charts/gone", "modules/charts/src/gone.ts"],
    ]),
    files: new Set(["modules/charts/src/index.ts", "modules/charts/src/fields.ts"]),
  });
  const resolve = reachResolve(array, "", new Set(files.map((f) => f.path)));
  expect(resolve("modules/shop/Page.tsx", "@acme/charts")).toBe("modules/charts/src/index.ts");
  expect(resolve("modules/shop/Page.tsx", "@acme/charts?url")).toBe("modules/charts/src/index.ts");
  expect(resolve("modules/charts/src/index.ts", "./fields.ts")).toBe("modules/charts/src/fields.ts");
  // An entry whose file the project does not hold, a subpath no entry names and any other package: not followed.
  expect(resolve("modules/shop/Page.tsx", "@acme/charts/gone")).toBeUndefined();
  expect(resolve("modules/shop/Page.tsx", "@acme/charts/src/fields.ts")).toBeUndefined();
  expect(resolve("modules/shop/Page.tsx", "@acme/other")).toBeUndefined();
});
