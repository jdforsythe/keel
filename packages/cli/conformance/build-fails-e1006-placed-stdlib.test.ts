// Spec: k.compiler, Conformance "`keel build` of a project whose `modules/a/routes.ts` throws prints one E1006 naming that file, counts it among its summary's errors and exits 1, with a `client` deployable and with `node` ones only."
// Spec: k.compiler, Build-time evaluation "a `routes.ts` throwing or exporting no `routes` ... is E1006, with file and message" (a placed stdlib package's `./routes` is one of "each `routes.ts`"; "In `keel build` ... the build exits 1").
// Seed: 1337 (no property: one fixed shape; the message is a fixed string). Assumes: a stdlib package is found through an app module's `deps` in the project's `node_modules`, its module id is the `id` of its root `module.ts`; one `diag` record with code E1006 whose text names the package's `routes.js`; the final `summary` record carries `counts.errors` of at least 1; exit status 1; no `surface.json` outside `node_modules`.
// Beside the app `routes.ts` case in build-fails-e1006-0175.test.ts.
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { SLOW, cleanup, keelRun, materialize, nodeTree } from "./boundary-support.ts";

const ID = "widgets";
const PKG = `node_modules/@keel/std-${ID}`;

const surfaces = (root: string): string[] => {
  const found: string[] = [];
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = path.join(root, e.name);
    if (e.isDirectory()) found.push(...surfaces(p));
    else if (e.name === "surface.json") found.push(p);
  }
  return found;
};

test(
  "`keel build` of a project whose placed stdlib package's `./routes` throws prints one E1006 naming that file, counts it among its summary's errors, exits 1 and writes no `surface.json`",
  () => {
    const dir = materialize({
      ...nodeTree("node"),
      "topology.ts": `import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['a', '${ID}'], adapter: 'node' } })\n`,
      "modules/a/module.ts": `import { module } from '@keel/compiler'\nexport default module({ id: 'a', deps: ['@keel/std-${ID}'], capabilities: [], public: { exports: [] } })\n`,
      [`${PKG}/package.json`]: JSON.stringify({
        name: `@keel/std-${ID}`,
        version: "0.0.0",
        type: "module",
        exports: {
          ".": "./index.js",
          "./module": "./module.js",
          "./contract": "./contract.js",
          "./routes": "./routes.js",
        },
      }),
      [`${PKG}/index.js`]: "export const marker = 1\n",
      [`${PKG}/module.js`]: `import { module } from '@keel/compiler'\nexport default module({ id: '${ID}', deps: [], capabilities: [], public: { exports: [] } })\n`,
      [`${PKG}/contract.js`]: `export const ${ID} = { id: '${ID}' }\n`,
      [`${PKG}/routes.js`]: "throw new Error('boom-placed')\nexport const routes = {}\n",
    });
    try {
      const r = keelRun(dir, ["build"]);
      const records = r.out
        .split("\n")
        .filter((l) => l.startsWith("{"))
        .map((l): unknown => JSON.parse(l));
      const e1006 = records.filter((x) => typeof x === "object" && x !== null && Reflect.get(x, "code") === "E1006");
      expect(e1006, r.out).toHaveLength(1);
      expect(JSON.stringify(e1006[0])).toContain(`std-${ID}`);
      expect(JSON.stringify(e1006[0])).toContain("routes.js");
      const summary = records.find((x) => typeof x === "object" && x !== null && Reflect.get(x, "kind") === "summary");
      const counts = typeof summary === "object" && summary !== null ? Reflect.get(summary, "counts") : undefined;
      const errors = typeof counts === "object" && counts !== null ? Reflect.get(counts, "errors") : undefined;
      expect(typeof errors === "number" ? errors : 0).toBeGreaterThanOrEqual(1);
      expect(r.status, r.out).toBe(1);
      expect(surfaces(dir)).toEqual([]);
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);
