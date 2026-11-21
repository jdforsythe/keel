// Spec: k.compiler, Conformance "A `routes.ts` whose graph reaches a `*.server.ts` file importing a CommonJS package that `require`s `events` evaluates: `routes.json` lists its routes and no E1006 is printed."
// Seed 1337 (no generated input). Assumes: `keel build` writes `dist/api/routes.json` for deployable `api` and the file's text names the route id `m.dirs`; the CommonJS package is a fixture in `node_modules/cjs-events`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { SLOW, built, cleanup, materialize, write } from "./boundary-support.ts";
import { appDataTree } from "./app-data-support.ts";

test(
  "A `routes.ts` whose graph reaches a `*.server.ts` file importing a CommonJS package that `require`s `events` evaluates: `routes.json` lists its routes and no E1006 is printed.",
  () => {
    const tree = appDataTree();
    const dirs = tree["modules/m/dirs.server.ts"] ?? "";
    const typed = { "node_modules/cjs-events/index.d.ts": "declare const pkg: { make: () => object };\nexport default pkg;\n" };
    const dir = materialize({
      ...tree,
      "modules/m/bus.server.ts": "import pkg from 'cjs-events'\nexport const bus: object = pkg.make()\n",
      "modules/m/dirs.server.ts": `import { bus } from './bus.server.ts'\nvoid bus\n${dirs}`,
    });
    try {
      write(dir, {
        "node_modules/cjs-events/package.json": '{"name":"cjs-events","version":"1.0.0","main":"index.js","types":"index.d.ts"}\n',
        ...typed,
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
