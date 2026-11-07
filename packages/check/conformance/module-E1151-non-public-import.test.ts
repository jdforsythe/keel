// Spec: k.module, clause "Importing a non-public export of another module reports E1151 at the import; adding it to `public.exports` clears it."
// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { codesOf, exportFile, has, importer, lowerId, manifestFile, pascal, SEED } from "./module-support.ts";

const distinct = fc.tuple(lowerId, lowerId, pascal, pascal).filter(([a, b, x, y]) => a !== b && x !== y);

test("importing a non-public export of another module reports E1151 at the import", () => {
  fc.assert(
    fc.property(distinct, ([a, b, secret, pub]) => {
      const files = [
        manifestFile({ id: b, exports: [pub] }),
        exportFile(`modules/${b}`, secret),
        exportFile(`modules/${b}`, pub),
        manifestFile({ id: a, deps: [b] }),
        importer(a, b, secret),
      ];
      const d = codesOf(files, "E1151");
      expect(d.length).toBeGreaterThanOrEqual(1);
      expect(d[0]?.path).toBe(`modules/${a}/OrderCard.ts`);
      expect(d[0]?.line).toBe(1);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("adding the imported export to public.exports clears E1151", () => {
  fc.assert(
    fc.property(distinct, ([a, b, secret]) => {
      const mk = (exports: string[]) => [
        manifestFile({ id: b, exports }),
        exportFile(`modules/${b}`, secret),
        manifestFile({ id: a, deps: [b] }),
        importer(a, b, secret),
      ];
      expect(has(mk([]), "E1151")).toBe(true);
      expect(has(mk([secret]), "E1151")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1151: importing a private export from within the same module reports nothing", () => {
  fc.assert(
    fc.property(lowerId, pascal, (a, secret) => {
      const files = [manifestFile({ id: a }), exportFile(`modules/${a}`, secret), importer(a, a, secret)];
      expect(has(files, "E1151")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1151: the diagnostic message is one line under 90 chars", () => {
  const files = [
    manifestFile({ id: "catalog" }),
    exportFile("modules/catalog", "Secret"),
    manifestFile({ id: "orders", deps: ["catalog"] }),
    importer("orders", "catalog", "Secret"),
  ];
  for (const d of codesOf(files, "E1151")) {
    expect(d.message.length).toBeLessThan(90);
    expect(d.message).not.toContain("\n");
  }
});
