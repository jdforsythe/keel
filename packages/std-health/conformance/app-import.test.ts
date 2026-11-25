// Spec: std.health, clause "An app module with `@keel/std-health` in `deps` that imports `@keel/std-health/Health` gets no k.module diagnostic."
// Spec: std.health, clause "The same import without `@keel/std-health` in `deps` reports E1152 at the import."
// Spec: std.health, clause "Importing `@keel/std-health/loadHealth`, a non-public file, reports E1151, even with the package in `deps`."
// Seed 1337
import { check } from "@keel/check";
import { expect, test } from "vitest";
import { appFiles, moduleCodes, packageFiles } from "./support.ts";

const PKG = "@keel/std-health";
const IMPORTER = "modules/orders/OrderCard.ts";

test("An app module with `@keel/std-health` in `deps` that imports `@keel/std-health/Health` gets no k.module diagnostic", () => {
  const files = [...packageFiles(), ...appFiles([PKG], "Health")];
  expect(moduleCodes(files)).toEqual([]);
});

test("The same import without `@keel/std-health` in `deps` reports E1152 at the import", () => {
  const files = [...packageFiles(), ...appFiles([], "Health")];
  const hits = check(files, { types: false }).diagnostics.filter((d) => d.code === "E1152");
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.every((d) => d.path === IMPORTER)).toBe(true);
  expect(hits[0]?.line).toBe(1);
}, 30_000);

test("Importing `@keel/std-health/loadHealth`, a non-public file, reports E1151, even with the package in `deps`", () => {
  const files = [...packageFiles(), ...appFiles([PKG], "loadHealth")];
  const hits = check(files, { types: false }).diagnostics.filter((d) => d.code === "E1151");
  expect(hits.length).toBeGreaterThan(0);
  expect(hits[0]?.path).toBe(IMPORTER);
  expect(hits[0]?.line).toBe(1);
}, 30_000);
