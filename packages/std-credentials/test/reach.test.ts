// Fixed fixtures. E2201 and E2202 read a file's own `import`, `export ... from` and `import()` declarations of the
// entry; a `require` and a helper file that re-exports it are not followed.
import { check } from "@keel/check";
import "@keel/std-credentials/tools";
import { expect, test } from "vitest";

const manifest = `import { module } from "@keel/compiler"
export default module({ id: "a", deps: ["@keel/std-credentials"], capabilities: [], public: { exports: [], routes: [] } })
`;
const topo = `import { topology } from "@keel/server"
export default topology({ web: { modules: ["a"], adapter: "static" } })
`;
const codes = (files: { path: string; source: string }[], code: string) =>
  check([{ path: "modules/a/module.ts", source: manifest }, { path: "topology.ts", source: topo }, ...files], {
    types: false,
  }).diagnostics.filter((d) => d.code === code);

test("a createRequire call of the entry is not E2201", () => {
  const source =
    'import { createRequire } from "node:module"\nexport const c = createRequire(import.meta.url)("@keel/std-credentials/server")\n';
  expect(codes([{ path: "modules/a/x.ts", source }], "E2201")).toHaveLength(0);
});

test("a helper outside modules/ that re-exports the entry, imported by a static module, is not E2202", () => {
  const helper = 'export { credentials } from "@keel/std-credentials/server"\n';
  const user = 'import { credentials } from "../../lib/creds.server.ts"\nexport const c = credentials\n';
  expect(
    codes(
      [
        { path: "lib/creds.server.ts", source: helper },
        { path: "modules/a/x.server.ts", source: user },
      ],
      "E2202",
    ),
  ).toHaveLength(0);
});

test("the fixtures fire on the plain import forms", () => {
  const plain = 'import { credentials } from "@keel/std-credentials/server"\nexport const c = credentials\n';
  expect(codes([{ path: "modules/a/x.ts", source: plain }], "E2201")).toHaveLength(1);
  expect(codes([{ path: "modules/a/x.server.ts", source: plain }], "E2202")).toHaveLength(1);
});
