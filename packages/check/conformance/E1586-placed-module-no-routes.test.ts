// Spec: k.topology, clause "A placed stdlib module whose `./contract` export resolves and `./routes` does not is one E1586 at its `topology.ts` id in `keel check` and `keel build`; both or neither is none."
// Spec: k.topology, Rules "E1586 a placed stdlib module whose `./contract` resolves and `./routes` does not (at its id)"
// Seed: 1337 (module ids are drawn by fast-check). The `keel check` half; the `keel build` half is
// packages/cli/conformance/topology-e1586-build.test.ts (this package does not depend on @keel/cli).
// PENDING: unbuilt (RFC 0172 build); skipped until `check()` reports E1586. The fixture lives here, not in
// fixtures-by-code.ts: it needs a package on disk, and fixture-per-code.test.ts rejects a fixture for a code
// `reportedCodes()` does not list yet. ASSUMPTION: a stdlib package is found through an app module's `deps`
// (`@keel/std-<id>`) under `root`'s `node_modules`, and the module id it places is the `id` of its root `module.ts`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { check } from "@keel/check";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED } from "./support.ts";

type Case = "contract-only" | "routes-missing-file" | "both" | "neither";
let tmp = "";
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-e1586-"));
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const write = (p: string, text: string): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};

/** `node_modules/@keel/std-<id>/` with a root `module.ts`, a `package.json` `exports` map and the files it names. */
const installPackage = (root: string, id: string, shape: Case): void => {
  const dir = path.join(root, "node_modules", "@keel", `std-${id}`);
  const exports: Record<string, string> = { "./module": "./module.ts" };
  if (shape !== "neither") exports["./contract"] = "./contract.ts";
  if (shape === "routes-missing-file" || shape === "both") exports["./routes"] = "./routes.ts";
  write(
    path.join(dir, "package.json"),
    JSON.stringify({ name: `@keel/std-${id}`, version: "0.0.0", type: "module", exports }),
  );
  write(
    path.join(dir, "module.ts"),
    `export default { id: '${id}', deps: [], capabilities: [], public: { exports: [] } }\n`,
  );
  if (shape !== "neither") write(path.join(dir, "contract.ts"), `export const ${id} = { id: '${id}' }\n`);
  if (shape === "both") write(path.join(dir, "routes.ts"), `export const routes = {}\n`);
};

const TOPOLOGY = (id: string): string =>
  `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['a', '${id}'], adapter: 'node' },\n})\n`;

const project = (id: string, shape: Case) => {
  const root = fs.mkdtempSync(path.join(tmp, "p-"));
  installPackage(root, id, shape);
  const files = [
    { path: "topology.ts", source: TOPOLOGY(id) },
    {
      path: "modules/a/module.ts",
      source: `export default { id: 'a', deps: ['@keel/std-${id}'], capabilities: [], public: { exports: [] } }\n`,
    },
  ];
  return check(files, { types: false, root: path.join(root, path.sep) }).diagnostics.filter((d) => d.code === "E1586");
};

const ID = fc.stringMatching(/^[a-z]{3,8}$/).filter((s) => s !== "a");

describe("k.topology: E1586", () => {
  test.skip("A placed stdlib module whose `./contract` export resolves and `./routes` does not is one E1586 at its `topology.ts` id in `keel check`: `./routes` absent from `exports`", () => {
    fc.assert(
      fc.property(ID, (id) => {
        const d = project(id, "contract-only");
        expect(d).toHaveLength(1);
        expect(d[0]).toMatchObject({ code: "E1586", path: "topology.ts", line: 4 });
        expect(String(d[0]?.message)).toContain(`module "${id}": @keel/std-${id} exports ./contract and no ./routes`);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  test.skip("one E1586 at the id when `./routes` is in `exports` but names a file the package does not hold", () => {
    fc.assert(
      fc.property(ID, (id) => {
        const d = project(id, "routes-missing-file");
        expect(d).toHaveLength(1);
        expect(d[0]).toMatchObject({ code: "E1586", path: "topology.ts" });
      }),
      { seed: SEED, numRuns: 8 },
    );
  });

  test.skip("both `./contract` and `./routes` resolving is none", () => {
    fc.assert(
      fc.property(ID, (id) => expect(project(id, "both")).toEqual([])),
      { seed: SEED, numRuns: 8 },
    );
  });

  test.skip("neither export (a runner-only module) is none and stays silent", () => {
    fc.assert(
      fc.property(ID, (id) => expect(project(id, "neither")).toEqual([])),
      { seed: SEED, numRuns: 8 },
    );
  });
});
