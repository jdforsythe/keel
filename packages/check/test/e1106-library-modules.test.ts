import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const ROOT = "node_modules/@acme/units";
const EVEN =
  "import { s } from '@keel/schema'\nexport const Even = s.format('units.even', s.int(), { check: (v) => v % 2 === 0, gen: { from: s.int(), map: (n) => n * 2 } })\n";
const manifest = (id: string, path: string): { path: string; source: string } => ({
  path,
  source: `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`,
});

describe("E1106 in a library folder's modules/", () => {
  it("a library's own folder file under modules/ keeps E1106 and its src/ file does not", () => {
    const files = [
      {
        path: `${ROOT}/package.json`,
        source: JSON.stringify({ name: "@acme/units", version: "1.0.0", type: "module", keel: "library" }),
      },
      manifest("units", `${ROOT}/module.ts`),
      { path: `${ROOT}/src/Even.schema.ts`, source: EVEN },
      { path: "modules/shop/Even.schema.ts", source: EVEN },
    ];
    const paths = check(files, { types: false })
      .diagnostics.filter((d) => d.code === "E1106")
      .map((d) => d.path);
    expect(paths).toEqual(["modules/shop/Even.schema.ts"]);
  });
});
