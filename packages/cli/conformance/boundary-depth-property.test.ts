// k.boundary, Server-only "A server-only file is a file named `*.server.*` or `*.guard.*`, in the app or a package, unless its module is one only `client` deployables list (a file under `modules/<id>/` is module `<id>`'s, a stdlib package's file its module's; a file outside every module is server-only). In a module a `node` or `static` deployable lists, loaders and actions (E1551) and guards (E1009) live in server-only files and run only on the server or at build; no byte of a server-only file, nor of what only server-only files import, is in an asset served to a browser. In a module only `client` deployables list nothing is server-only: its `*.server.*` and `*.guard.*` files hold the loaders, actions and guards the browser runs (k.router), are browser files (k.host) and ship like any other."
// Seed 1337 (fc.assert below). The real binary over one node fixture of boundary-support.ts, rebuilt per generated case: a chain of 0 to 4 plain files below a server-only file (`*.server.ts` or `*.guard.ts`) that the loader imports,
// a generated canary at a generated depth of the chain (the server-only file included). Each run builds, then searches every file under `dist/` but `server.mjs` and its map; the same canary is in `server.mjs`.
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, expect, test } from "vitest";
import { SEED, SLOW, built, cleanup, filesHolding, materialize, nodeTree, write } from "./boundary-support.ts";

let dir = "";
beforeAll(() => {
  dir = materialize(nodeTree("node"));
}, SLOW);
afterAll(() => cleanup(dir));

const LOAD = nodeTree("node")["modules/a/load.server.ts"] ?? "";

/** The chain files: `root` (the server-only file) then `h1` ... `h<depth>`, the canary in the file at `at`. */
function chain(root: string, depth: number, at: number, canary: string): Record<string, string> {
  const files: Record<string, string> = {};
  const names = [root.replace(/\.[^.]+\.ts$/, ""), ...Array.from({ length: depth }, (_, i) => `h${i + 1}`)];
  for (let k = 0; k <= depth; k++) {
    const own = k === at ? canary : "-";
    const next = k < depth ? names[k + 1] : undefined;
    const file = k === 0 ? root : `${names[k]}.ts`;
    files[`modules/a/${file}`] =
      `${next === undefined ? "" : `import { ${next} } from './${next}.ts'\n`}export const ${names[k]} = '${own}'${next === undefined ? "" : ` + ${next}`}\n`;
  }
  return files;
}

test(
  "a canary at any depth of the imports below a server-only file is in no browser asset and is in `server.mjs`",
  () => {
    fc.assert(
      fc.property(
        fc.constantFrom("chain0.server.ts", "chain0.guard.ts"),
        fc.integer({ min: 0, max: 4 }),
        fc.nat({ max: 4 }),
        fc.stringMatching(/^[0-9a-f]{20}$/),
        (root, depth, rawAt, hex) => {
          const canary = `K_PROP_${hex}`;
          const at = rawAt % (depth + 1);
          write(dir, {
            ...chain(root, depth, at, canary),
            "modules/a/load.server.ts": `import { chain0 } from './${root}'\n${LOAD}Reflect.set(globalThis, 'chain', chain0)\n`,
          });
          const r = built(dir);
          expect(r.status, r.out).toBe(0);
          expect(filesHolding(join(dir, "dist"), canary, ["api/server.mjs", "api/server.mjs.map"])).toEqual([]);
          expect(filesHolding(join(dir, "dist", "api"), canary, [])).toEqual(["server.mjs"]);
        },
      ),
      { seed: SEED, numRuns: 8 },
    );
  },
  SLOW,
);
