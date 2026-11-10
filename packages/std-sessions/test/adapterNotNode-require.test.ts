// E2005 reads `require('...')` calls and `import x = require('...')` beside `import`; a non-relative alias hop is not followed.
import { check } from "@keel/check";
import { describe, expect, test } from "vitest";
import "../src/adapterNotNode.ts";

const client = {
  path: "topology.ts",
  source: "export default topology({ web: { modules: ['cart'], adapter: 'client' } })\n",
};
const routes = (src: string) => ({
  path: "modules/cart/routes.ts",
  source: `${src}\nexport const r = 1\n`,
});
const run = (files: readonly { path: string; source: string }[]) =>
  check(files, { types: false }).diagnostics.filter((d) => d.code === "E2005");

describe("E2005 require forms", () => {
  test.each([
    ["require with a string", "const r = require('@keel/std-sessions/routes')"],
    ["require with a template", "const r = require(`@keel/std-sessions/routes`)"],
    ["import equals require", "import r = require('@keel/std-sessions/routes')"],
    ["a require inside a function", "export const f = () => require('@keel/std-sessions/routes')"],
  ])("%s reports", (_n, src) => {
    expect(run([routes(src), client])).toHaveLength(1);
  });
  test.each([
    ["import type equals require", "import type r = require('@keel/std-sessions/routes')"],
    ["a computed require argument", "const n = 'x'; const r = require(`${n}`)"],
    ["require of another package", "const r = require('@keel/std-sessions/record')"],
    ["a member named require", "const r = loader.require('@keel/std-sessions/routes')"],
  ])("%s is clean", (_n, src) => {
    expect(run([routes(src), client])).toHaveLength(0);
  });
  test("a require through another project file reports", () => {
    const files = [
      routes("require('./hop.ts')"),
      {
        path: "modules/cart/hop.ts",
        source: "import r = require('@keel/std-sessions/routes')\n",
      },
      client,
    ];
    expect(run(files)).toHaveLength(1);
  });
  test("a non-relative alias hop is not followed", () => {
    const files = [
      routes("export * from '@app/ops'"),
      {
        path: "modules/cart/ops.ts",
        source: "export * from '@keel/std-sessions/routes'\n",
      },
      client,
    ];
    expect(run(files)).toHaveLength(0);
  });
});
