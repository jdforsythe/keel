// Spec: k.scaffold, clause "An operation whose edit set would introduce a diagnostic writes no file and reports E1353."
// Spec: k.scaffold, Rules "E1353 operation aborted, would break check; nothing written"
// Scenario: catalog keeps a second non-test file importing orders' contract, so the move's removal of unused deps
// (k.scaffold move) leaves `orders` in catalog's deps; OrdersPage imports OrderCard, so orders gains `catalog`: a
// deps cycle (E1153). The clean counterpart moves it without that dependency.
import { expect, it } from "vitest";
import { type Files, apply, dryRun, errText, only, rel, scaffoldRaw, snap, withOrders } from "./fixtures.ts";

const manifest = (id: string, deps: string[], exports: string[]) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps)}, capabilities: [], public: { exports: ${JSON.stringify(exports)} } })\n`;

function cyclic(): Files {
  const f = withOrders();
  f.set("modules/orders/module.ts", manifest("orders", [], ["OrderCard"]));
  f.set("modules/catalog/module.ts", manifest("catalog", ["orders"], []));
  const row = "modules/catalog/CatalogRow.tsx";
  f.set(
    row,
    `import OrderCard from '${rel(row, only(f, /(^|\/)OrderCard\.tsx$/))}'\nexport default function CatalogRow() {\n  return OrderCard\n}\n`,
  );
  const link = "modules/catalog/CatalogLink.ts";
  f.set(
    link,
    `import { orders } from '${rel(link, "modules/orders/orders.contract.ts")}'\nexport const CatalogLink = orders\n`,
  );
  return f;
}

it("an operation whose edit set would introduce a diagnostic writes no file and reports E1353", () => {
  const f = cyclic();
  const before = snap(f);
  const r = scaffoldRaw("move", { name: "OrderCard", to: "catalog" }, f);
  expect(r.ok).toBe(false);
  expect(errText(r)).toContain("E1353");
  expect(snap(f)).toBe(before);
  const p = dryRun("move", { name: "OrderCard", to: "catalog" }, f);
  expect(p.ok).toBe(false);
  expect(errText(p)).toContain("E1353");
});

it("the same move without the conflicting dependency applies cleanly", () => {
  expect(() => apply("move", { name: "OrderCard", to: "catalog" }, withOrders())).not.toThrow();
});
