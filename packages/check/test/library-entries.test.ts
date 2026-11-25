// k.module E1151, k.library In an app: an import of a subpath a library's `exports` write whole (`./server`,
// `./tools`) reaches an entry, not a file, so `public.exports` does not judge it; E1152 still does. A file subpath and a
// name reached through a `./*` pattern stay judged by `public.exports`.
import { expect, it } from "vitest";
import { check } from "../src/index.ts";

const LIB = "node_modules/@acme/jobs";
const manifest = (id: string, deps: string[], exports: string[] = []) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps).replaceAll('"', "'")}, capabilities: [], public: { exports: ${JSON.stringify(exports).replaceAll('"', "'")} } })\n`;
const entry = (to: string) => ({ keel: to, default: to });

const project = (deps: string[]) => [
  { path: "modules/shop/module.ts", source: manifest("shop", deps) },
  {
    path: `${LIB}/package.json`,
    source: JSON.stringify({
      name: "@acme/jobs",
      version: "1.0.0",
      type: "module",
      keel: "library",
      exports: {
        ".": entry("./src/index.ts"),
        "./server": entry("./src/server.ts"),
        "./tools": entry("./src/tools/index.ts"),
        "./*": entry("./src/*.ts"),
      },
    }),
  },
  { path: `${LIB}/module.ts`, source: manifest("jobs", [], ["Badge"]) },
  { path: `${LIB}/src/index.ts`, source: "export { Badge } from './Badge.ts'\n" },
  { path: `${LIB}/src/Badge.ts`, source: "export const Badge = 1\n" },
  { path: `${LIB}/src/Hidden.ts`, source: "export const Hidden = 1\n" },
  { path: `${LIB}/src/server.ts`, source: "export const serve = 1\n" },
  { path: `${LIB}/src/tools/index.ts`, source: "export const lineCol = 1\n" },
];

const codes = (path: string, spec: string, deps = ["@acme/jobs"]): string[] =>
  check([...project(deps), { path, source: `import { x } from '${spec}'\nexport const y = x\n` }], { types: false })
    .diagnostics.filter((d) => d.path === path && (d.code === "E1151" || d.code === "E1152"))
    .map((d) => d.code);

it("an app file importing a library's ./server or ./tools entry is no E1151", () => {
  expect(codes("modules/shop/events.server.ts", "@acme/jobs/server")).toEqual([]);
  expect(codes("modules/shop/rule.ts", "@acme/jobs/tools")).toEqual([]);
});

it("another library's file importing a library's ./tools entry is no E1151", () => {
  const files = [
    ...project(["@acme/flows"]),
    { path: "node_modules/@acme/flows/package.json", source: JSON.stringify({ name: "@acme/flows", keel: "library" }) },
    { path: "node_modules/@acme/flows/module.ts", source: manifest("flows", ["@acme/jobs"]) },
  ];
  const path = "node_modules/@acme/flows/src/tools/rule.ts";
  const found = check([...files, { path, source: "import { lineCol } from '@acme/jobs/tools'\nexport const y = lineCol\n" }], {
    types: false,
  }).diagnostics.filter((d) => d.path === path && d.code === "E1151");
  expect(found).toEqual([]);
});

it("an entry import still needs the library in deps (E1152)", () => {
  expect(codes("modules/shop/events.server.ts", "@acme/jobs/server", [])).toEqual(["E1152"]);
  expect(codes("modules/shop/rule.ts", "@acme/jobs/tools", [])).toEqual(["E1152"]);
});

it("a file the ./* pattern reaches is judged by public.exports: Hidden is E1151, Badge is not", () => {
  expect(codes("modules/shop/Page.ts", "@acme/jobs/Hidden")).toEqual(["E1151"]);
  expect(codes("modules/shop/Page.ts", "@acme/jobs/Badge")).toEqual([]);
});

it("public.exports naming an entry is E1154: it lists files, and an entry needs no listing", () => {
  const files = project(["@acme/jobs"]).map((f) =>
    f.path === `${LIB}/module.ts` ? { ...f, source: manifest("jobs", [], ["Badge", "tools"]) } : f,
  );
  const found = check(files, { types: false }).diagnostics.filter((d) => d.code === "E1154");
  expect(found.map((d) => d.path)).toEqual([`${LIB}/module.ts`]);
});
