// k.server-deps Registration through a library: a library's `register(name, ...)` whose name is a parameter of the
// exported function holding it is judged at each app call, however many files the project holds (more than the parse
// memo keeps, so the library file is read again after the first parse).
import { check } from "@keel/check";
import { expect, test } from "vitest";

const ROOT = "node_modules/@acme/store";
const manifest = (id: string, deps: string[], exports: string[] = [], root = `modules/${id}`) => ({
  path: `${root}/module.ts`,
  source: `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps)}, capabilities: [], public: { exports: ${JSON.stringify(exports)} } })\n`,
});
const LEDGER = `${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, rungs: {}, mutation: {}, exports: [], clauses: [], a11y: [] })}\n`;
const STORE =
  "import { register } from '@keel/ctx'\nconst impl = () => ({})\nexport function store(name: string) {\n  return register(name, { real: impl, shell: impl, sim: impl })\n}\n";

test("a library's parameter-named register is judged at the app's call in a project of 400 files", () => {
  const filler = Array.from({ length: 400 }, (_, i) => ({
    path: `modules/a/f${i}.ts`,
    source: `export const f${i} = ${i}\n`,
  }));
  const files = [
    manifest("a", ["@acme/store"]),
    {
      path: `${ROOT}/package.json`,
      source: JSON.stringify({
        name: "@acme/store",
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
      }),
    },
    { path: `${ROOT}/index.js`, source: "export {}\n" },
    manifest("store", [], ["store"], ROOT),
    { path: `${ROOT}/src/index.ts`, source: "export * from './store.ts'\n" },
    { path: `${ROOT}/src/store.ts`, source: STORE },
    { path: `${ROOT}/.keel/ledger.json`, source: LEDGER },
    ...filler,
    {
      path: "modules/a/d.server.ts",
      source: "import { store } from '@acme/store'\nexport const d = store('a.items')\n",
    },
  ];
  const found = check(files, { types: false }).diagnostics.filter((d) => d.code === "E1607");
  expect(found.map((d) => `${d.path}:${d.line} ${d.message}`)).toEqual([]);
});
