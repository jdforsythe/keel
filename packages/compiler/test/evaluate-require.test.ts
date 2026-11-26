// Seed 1337. Build-time evaluation bundled as the server build (k.compiler Build-time evaluation): a CommonJS package
// that requires a Node built-in evaluates, and a problem fails the plugin's build while dev only warns.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { fixedTime, testTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterEach, beforeEach, expect, test } from "vitest";

const packages = path.dirname(fs.realpathSync(path.join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
let root = "";
const write = (rel: string, text: string): void => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-req-"));
  fs.mkdirSync(path.join(root, "node_modules", "@keel"), { recursive: true });
  for (const p of fs.readdirSync(packages))
    if (fs.existsSync(path.join(packages, p, "package.json")))
      fs.symlinkSync(path.join(packages, p), path.join(root, "node_modules", "@keel", p));
  write("node_modules/cjs-events/package.json", '{"name":"cjs-events","version":"1.0.0","main":"index.js"}\n');
  write(
    "node_modules/cjs-events/index.js",
    'const E = require("events");\nmodule.exports = { make: () => new E() };\n',
  );
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const routesFile = (id: string): string =>
  [
    'import { loader, manifest } from "@keel/router";',
    'import { contract } from "@keel/router/contract";',
    'import { ok, s } from "@keel/schema";',
    'import pkg from "cjs-events";',
    "const bus = pkg.make();",
    `const c = contract("m", { "m.${id}": { method: "GET", path: "/api/m/${id}", output: s.object({}) } });`,
    `const l = loader(c, "m.${id}", {}, async () => { void bus; return ok({}); });`,
    `export const routes = manifest(c, { "m.${id}": { loader: l } });`,
    "",
  ].join("\n");

test(
  "a routes.ts whose graph requires `events` through a CommonJS package evaluates and lists its routes",
  async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{3,8}$/), async (id) => {
        write("modules/m/routes.ts", routesFile(id));
        // Plain Node, not this runner: vitest's module loader gives an imported bundle a `require` Node does not.
        const out = execFileSync(process.execPath, [path.join(import.meta.dirname, "evaluate-child.ts"), root], {
          encoding: "utf8",
          timeout: testTime(50_000),
        });
        expect(JSON.parse(out)).toEqual({ problems: [], routes: [`m.${id}`] });
      }),
      { seed: 1337, numRuns: 3 },
    );
  },
  fixedTime(60_000),
);

test(
  "an evaluation problem fails the plugin's build at its render start with its keel: line and only warns under serve",
  async () => {
    write("modules/m/module.ts", "export default {}\n");
    write("modules/m/routes.ts", "export const other = 1;\n");
    write(
      "topology.ts",
      "import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['m'], adapter: 'node' } })\n",
    );
    for (const command of ["build", "serve"] as const) {
      const warnings: string[] = [];
      const p = keel();
      p.configResolved({ root, command });
      await p.buildStart.call({ warn: (m: string) => void warnings.push(m) });
      if (command === "build")
        expect(() => p.renderStart()).toThrow("keel: E1006 modules/m/routes.ts exports no routes");
      else expect(() => p.renderStart()).not.toThrow();
      expect(warnings).toContain("keel: E1006 modules/m/routes.ts exports no routes");
    }
  },
  fixedTime(60_000),
);
