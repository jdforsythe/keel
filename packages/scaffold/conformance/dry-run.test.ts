// Clause: `--dry-run` writes nothing and prints exactly the diff a following apply writes.
import { describe, expect, it } from "vitest";
import { type Files, apply, fresh, planOf, snap, withOrders, withSchema } from "./fixtures.ts";

const calls: [Parameters<typeof apply>[0], Record<string, unknown>, () => Files][] = [
  ["project", { name: "shop" }, () => new Map()],
  ["module", { id: "billing" }, fresh],
  ["route", { id: "orders.list", path: "/orders" }, withOrders],
  ["component", { id: "orders/OrderTile" }, fresh],
  ["store", { id: "orders.basket" }, fresh],
  ["rename", { kind: "component", from: "OrderCard", to: "OrderTile" }, withOrders],
  ["move", { name: "OrderCard", to: "catalog" }, withOrders],
  ["add-field", { schema: "Order", field: "note", type: "string.optional" }, () => withSchema(true)],
];

describe("plan (dry run)", () => {
  for (const [op, input, mk] of calls) {
    it(`${String(op)} --dry-run writes nothing and yields exactly the edit set the following apply writes`, () => {
      const files = mk();
      const before = snap(files);
      const p = planOf(op, input, files);
      expect(snap(files)).toBe(before);
      expect(p.ok).toBe(true);
      const a = apply(op, input, files);
      expect(snap(files)).toBe(before);
      if (p.ok) {
        expect(p.value.created).toEqual(a.created);
        expect(p.value.changed).toEqual(a.changed);
        expect(snap(p.value.files)).toBe(snap(a.files));
      }
    });
  }
});
