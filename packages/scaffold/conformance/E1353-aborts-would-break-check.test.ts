// Clause: an operation whose edit set would introduce a diagnostic writes no file and reports E1353.
// Scenario: moving OrderCard into catalog while catalog already depends on orders would create a deps cycle (E1153)
// and orders would import a module not in its deps; the clean counterpart moves it without that dependency.
import { expect, it } from "vitest";
import { type Files, apply, errText, only, planOf, rel, scaffoldRaw, snap, withOrders } from "./fixtures.ts";

const manifest = (id: string, deps: string[], exports: string[]) =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: ${JSON.stringify(deps)}, capabilities: [], public: { exports: ${JSON.stringify(exports)}, routes: [] } })\n`;

function cyclic(): Files {
  const f = withOrders();
  f.set("modules/orders/module.ts", manifest("orders", [], ["OrderCard"]));
  f.set("modules/catalog/module.ts", manifest("catalog", ["orders"], []));
  const row = "modules/catalog/CatalogRow.tsx";
  f.set(
    row,
    `import OrderCard from '${rel(row, only(f, /(^|\/)OrderCard\.tsx$/))}'\nexport default function CatalogRow() {\n  return OrderCard\n}\n`,
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
  const p = planOf("move", { name: "OrderCard", to: "catalog" }, f);
  expect(p.ok).toBe(false);
  expect(errText(p)).toContain("E1353");
});

it("the same move without the conflicting dependency applies cleanly", () => {
  expect(() => apply("move", { name: "OrderCard", to: "catalog" }, withOrders())).not.toThrow();
});
