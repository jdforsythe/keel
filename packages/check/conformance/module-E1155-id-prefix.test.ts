// Spec: k.module, clause "A route `show` declared in module `orders` without the `orders.` prefix reports E1155."
// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, codesOf, has, lowerId, manifestFile, routesFile } from "./module-support.ts";

const distinct = fc.tuple(lowerId, lowerId, lowerId).filter(([a, b]) => a !== b);

test("a route show declared in module orders without the orders. prefix reports E1155", () => {
  const files = [manifestFile({ id: "orders" }), routesFile("orders", ["show"])];
  const d = codesOf(files, "E1155");
  expect(d.length).toBeGreaterThanOrEqual(1);
  expect(d[0]?.path).toBe("modules/orders/routes.ts");
});

test("E1155: a route id prefixed by its module id reports nothing", () => {
  fc.assert(
    fc.property(lowerId, lowerId, (id, name) => {
      expect(has([manifestFile({ id }), routesFile(id, [`${id}.${name}`])], "E1155")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1155: a route id prefixed by another module's id is reported", () => {
  fc.assert(
    fc.property(distinct, ([a, b, name]) => {
      expect(has([manifestFile({ id: a }), routesFile(a, [`${b}.${name}`])], "E1155")).toBe(true);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

const STORE = (id: string, storeId: string) => ({
  path: `modules/${id}/cart.ts`,
  source: `import { store } from '@keel/store'\nexport const cart = store({} as never, {}, { id: '${storeId}' })\n`,
});
const TX = (id: string, name: string) => ({
  path: `modules/${id}/addItem.ts`,
  source: `import { transaction } from '@keel/store'\nimport { cart } from './cart.ts'\nexport const addItem = transaction(cart, '${name}', {} as never, (state) => state)\n`,
});
const ERR = (id: string, code: string) => ({
  path: `modules/${id}/OrderLocked.ts`,
  source: `import { s } from '@keel/schema'\nexport const OrderLocked = s.error('${code}', s.object({}))\n`,
});

test("E1155: a store id not prefixed by its module id is reported; prefixed is clean", () => {
  fc.assert(
    fc.property(distinct, ([id, other, name]) => {
      expect(has([manifestFile({ id }), STORE(id, `${other}.${name}`)], "E1155")).toBe(true);
      expect(has([manifestFile({ id }), STORE(id, `${id}.${name}`)], "E1155")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1155: a transaction name not prefixed by its module id is reported; prefixed is clean", () => {
  fc.assert(
    fc.property(distinct, ([id, other, name]) => {
      expect(has([manifestFile({ id }), TX(id, `${other}.${name}`)], "E1155")).toBe(true);
      expect(has([manifestFile({ id }), TX(id, `${id}.${name}`)], "E1155")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1155: an error code not prefixed by its module id is reported; prefixed is clean", () => {
  fc.assert(
    fc.property(distinct, ([id, other, name]) => {
      expect(has([manifestFile({ id }), ERR(id, `${other}.${name}`)], "E1155")).toBe(true);
      expect(has([manifestFile({ id }), ERR(id, `${id}.${name}`)], "E1155")).toBe(false);
    }),
    { seed: SEED, numRuns: 25 },
  );
});
