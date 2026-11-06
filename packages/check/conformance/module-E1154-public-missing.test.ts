// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { codesOf, exportFile, has, lowerId, manifestFile, pascal, routesFile, SEED } from "./module-support.ts";

test("E1154: public.exports naming an export that does not exist is reported at the manifest", () => {
  fc.assert(
    fc.property(lowerId, pascal, (id, ghost) => {
      const d = codesOf([manifestFile({ id, exports: [ghost] })], "E1154");
      expect(d.length).toBeGreaterThanOrEqual(1);
      expect(d[0]?.path).toBe(`modules/${id}/module.ts`);
      expect(d[0]?.message).toContain(ghost);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1154: public.exports naming an existing export file reports nothing", () => {
  fc.assert(
    fc.property(lowerId, pascal, (id, name) => {
      expect(has([manifestFile({ id, exports: [name] }), exportFile(`modules/${id}`, name)], "E1154")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1154: public.routes naming a route that does not exist is reported; an existing one is clean", () => {
  fc.assert(
    fc.property(lowerId, lowerId, (id, name) => {
      const route = `${id}.${name}`;
      expect(has([manifestFile({ id, routes: [route] }), routesFile(id, [])], "E1154")).toBe(true);
      expect(has([manifestFile({ id, routes: [route] }), routesFile(id, [route])], "E1154")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});
