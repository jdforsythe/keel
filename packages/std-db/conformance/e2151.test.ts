// Spec: std.db, clause "An app file importing `@keel/std-db/sqlite` is E2151; the generated entry is not."
// std.db, Rules "E2151 an app file imports `@keel/std-db` (no fix)"
// Seed: 1337.
// Assumption: as for std.jobs E2501, `check()` imports nothing, so the rule registers by importing `@keel/std-db/tools`.
// Assumption: the generated entry is not a project file `check` reads (k.deploy writes `server.mjs` into `dist/`); "the generated entry is not" is
// shown by a project whose `topology.ts` sets `storage` and whose app files do not import the package: no E2151.
// The spec names no path at which an entry file would appear in the files given to `check`.
import { check } from "@keel/check";
import "@keel/std-db/tools";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./fixtures.ts";

type Files = Parameters<typeof check>[0];
const manifest = `import { module } from "@keel/compiler"
export default module({ id: "orders", capabilities: ["clock", "random", "storage"] })
`;
const topo = (storage: string) => `import { topology } from "@keel/server"
export default topology({ web: { modules: ["orders"], adapter: "node", storage: "${storage}" } })
`;
const found = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => d.code === "E2151");
const project = (importLine: string, path: string): Files => [
  { path: "modules/orders/module.ts", source: manifest },
  { path, source: `${importLine}\nexport const x = 1\n` },
  { path: "topology.ts", source: topo("sqlite") },
];
const word = fc.stringMatching(/^[a-z]{3,10}$/);

test("An app file importing `@keel/std-db/sqlite` is E2151; the generated entry is not.", () => {
  fc.assert(
    fc.property(word, (name) => {
      const path = `modules/orders/${name}.server.ts`;
      expect(found(project(`import { sqlite } from "@keel/std-db/sqlite"`, path)).length).toBe(1);
      expect(found(project(`import { ok } from "@keel/schema"`, path)).length).toBe(0);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E2151 fires on an app file importing `@keel/std-db`, `@keel/std-db/sqlite`, `@keel/std-db/postgres` or `@keel/std-db/tools`, and has no fix.", () => {
  const specs = ["@keel/std-db", "@keel/std-db/sqlite", "@keel/std-db/postgres", "@keel/std-db/tools"];
  fc.assert(
    fc.property(fc.constantFrom(...specs), word, (spec, name) => {
      const d = found(project(`import * as db from "${spec}"\nexport const y = db`, `modules/orders/${name}.ts`));
      expect(d.length).toBe(1);
      expect(d[0]?.fix).toBeUndefined();
    }),
    { seed: SEED, numRuns: 20 },
  );
});
