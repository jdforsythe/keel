// Spec: k.compiler, clause "A `routes.ts` whose graph reaches a `*.server.ts` file importing a CommonJS package that `require`s `events` evaluates: `routes.json` lists its routes and no E1006 is printed."
// k.compiler, Build-time evaluation "bundled as the server build bundles: a package's CommonJS code may `require` Node built-ins and other packages (`pg` does)."
// Seed 1337 (the exported name is generated). Assumes: the plugin's build-time evaluation reports through the `warn` of `buildStart` as build-eval-routes.test.ts reads it; the CommonJS package is a fixture in `node_modules/cjs-events` (`pg-pool` does the same `require("events")`).
// `routes.json` itself is written by the CLI build and is not read here: the `routes.json` half needs the CLI build.
import fs from "node:fs";
import path from "node:path";
import keel from "@keel/compiler/vite";
import fc from "fast-check";
import { afterEach, beforeEach, expect, test } from "vitest";

const packages = path.dirname(fs.realpathSync(path.join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
let root = "";
beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-ev-"));
  fs.mkdirSync(path.join(root, "node_modules", "@keel"), { recursive: true });
  for (const p of fs.readdirSync(packages))
    if (fs.existsSync(path.join(packages, p, "package.json")))
      fs.symlinkSync(path.join(packages, p), path.join(root, "node_modules", "@keel", p));
  fs.mkdirSync(path.join(root, "node_modules", "cjs-events"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "node_modules", "cjs-events", "package.json"),
    '{"name":"cjs-events","version":"1.0.0","main":"index.js"}\n',
  );
  fs.writeFileSync(
    path.join(root, "node_modules", "cjs-events", "index.js"),
    'const EventEmitter = require("events");\nmodule.exports = { make: () => new EventEmitter() };\n',
  );
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test("A `routes.ts` whose graph reaches a `*.server.ts` file importing a CommonJS package that `require`s `events` evaluates: no E1006 is printed.", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z]{3,8}$/), async (name) => {
      const dir = path.join(root, "modules", "m");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, `${name}.server.ts`),
        'import pkg from "cjs-events";\nexport const bus: unknown = pkg.make();\n',
      );
      fs.writeFileSync(
        path.join(dir, "m.contract.ts"),
        'import { contract } from "@keel/router/contract";\nexport const m = contract("m", { "m.home": { path: "/" } });\n',
      );
      fs.writeFileSync(
        path.join(dir, "routes.ts"),
        `import { manifest } from "@keel/router";\nimport { m } from "./m.contract.ts";\nimport { bus } from "./${name}.server.ts";\nvoid bus;\nexport const routes = manifest(m, { "m.home": {} });\n`,
      );
      const warnings: string[] = [];
      const p = keel();
      p.configResolved({ root, command: "build" });
      await p.buildStart.call({ warn: (m: string) => void warnings.push(m) });
      expect(warnings.filter((m) => m.includes("E1006"))).toEqual([]);
    }),
    { seed: 1337, numRuns: 3 },
  );
}, 60000);
