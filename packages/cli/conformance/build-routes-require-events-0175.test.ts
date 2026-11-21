// Spec: k.compiler, Conformance "A `routes.ts` whose graph reaches a `*.server.ts` file importing a CommonJS package that `require`s `events` evaluates: `routes.json` lists its routes and no E1006 is printed."
// Seed 1337 (no generated input). Assumes: `keel build` writes `dist/api/routes.json` for deployable `api` and the file's text names the route id `m.dirs`; the CommonJS package is a fixture in `node_modules/cjs-events`.
// Pending: the evaluation has no `require` yet.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { SLOW, built, cleanup, materialize, write } from "./boundary-support.ts";
import { appDataTree } from "./app-data-support.ts";

test.skip(
  "A `routes.ts` whose graph reaches a `*.server.ts` file importing a CommonJS package that `require`s `events` evaluates: `routes.json` lists its routes and no E1006 is printed.",
  () => {
    const tree = appDataTree();
    const dirs = tree["modules/m/dirs.server.ts"] ?? "";
    const dir = materialize({
      ...tree,
      "modules/m/dirs.server.ts": `import pkg from 'cjs-events'\nexport const bus: unknown = pkg.make()\n${dirs}`,
    });
    try {
      write(dir, {
        "node_modules/cjs-events/package.json": '{"name":"cjs-events","version":"1.0.0","main":"index.js"}\n',
        "node_modules/cjs-events/index.js": 'const E = require("events");\nmodule.exports = { make: () => new E() };\n',
      });
      const r = built(dir);
      expect(r.status, r.out).toBe(0);
      expect(r.out).not.toContain("E1006");
      expect(readFileSync(join(dir, "dist/api/routes.json"), "utf8")).toContain("m.dirs");
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);
