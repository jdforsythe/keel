// Spec: std.postgres, Conformance "E2451, E2452, E2458 and W2456 each fire on a fixture, not on its clean twin" (E2451 and E2452 here).
// Spec: std.postgres, Rules "E2451 `@keel/std-postgres/server` imported (static or `import()`) outside a `*.server.ts` file, tests and type-only imports aside · E2452 that import in a module a deployable other than `node` serves"
// Seed: 1337.
// Assumption: a `client` deployable (adapter `client`) is "a deployable other than `node`"; a test file is a path ending `.test.ts`.
// Skipped until `@keel/std-postgres` exists.
import fc from "fast-check";
import { expect, test } from "vitest";
import { dbFile, found, project } from "./rules-fixtures.ts";

const SEED = 1337;
const word = fc.stringMatching(/^[a-z]{3,10}$/);

test.skip("E2451 fires on a static import of `@keel/std-postgres/server` outside a `*.server.ts` file, not on its `*.server.ts` twin", () => {
  fc.assert(
    fc.property(word, (name) => {
      expect(found(project(`modules/kitchen/${name}.ts`, dbFile('"kitchen.db"')), "E2451").length).toBe(1);
      expect(found(project(`modules/kitchen/${name}.server.ts`, dbFile('"kitchen.db"')), "E2451").length).toBe(0);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test.skip("E2451 fires on `import()` of `@keel/std-postgres/server` outside a `*.server.ts` file, not on its twin", () => {
  const src = `export const load = () => import("@keel/std-postgres/server")\n`;
  expect(found(project("modules/kitchen/load.ts", src), "E2451").length).toBe(1);
  expect(found(project("modules/kitchen/load.server.ts", src), "E2451").length).toBe(0);
});

test.skip("E2451 does not fire on a type-only import or in a test file", () => {
  const typeOnly = `import type { database } from "@keel/std-postgres/server"\nexport type D = typeof database\n`;
  expect(found(project("modules/kitchen/types.ts", typeOnly), "E2451").length).toBe(0);
  expect(found(project("modules/kitchen/db.test.ts", dbFile('"kitchen.db"')), "E2451").length).toBe(0);
});

test.skip("E2452 fires on that import in a module a `client` deployable serves, not in the same module served by `node`", () => {
  const files = (adapter: string) => project("modules/kitchen/kitchenDb.server.ts", dbFile('"kitchen.db"'), adapter);
  expect(found(files("client"), "E2452").length).toBe(1);
  expect(found(files("node"), "E2452").length).toBe(0);
});
