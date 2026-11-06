// Clause: operations are deterministic — same input twice yields identical output (spec: computed from artifacts, never text search).
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED, apply, fresh, lowerName, pascalName, snap, withOrders, withSchema } from "./fixtures.ts";

// seed 1337
it("every operation run twice on equal input yields identical files, created and changed", () => {
  fc.assert(
    fc.property(lowerName, pascalName, (n, P) => {
      const calls: [Parameters<typeof apply>[0], Record<string, unknown>, () => Map<string, string>][] = [
        ["project", { name: n }, () => new Map()],
        ["module", { id: n }, fresh],
        ["route", { id: `orders.${n}`, path: `/${n}/:id` }, withOrders],
        ["component", { id: `orders/${P}` }, fresh],
        ["store", { id: `orders.${n}` }, fresh],
        ["rename", { kind: "component", from: "OrderCard", to: P }, withOrders],
        ["move", { name: "OrderCard", to: "catalog" }, withOrders],
        ["add-field", { schema: "Order", field: n, type: "string.optional" }, () => withSchema(true)],
      ];
      for (const [op, input, mk] of calls) {
        const a = apply(op, input, mk());
        const b = apply(op, input, mk());
        expect(snap(a.files), op).toBe(snap(b.files));
        expect(a.created, op).toEqual(b.created);
        expect(a.changed, op).toEqual(b.changed);
      }
    }),
    { seed: SEED, numRuns: RUNS },
  );
});
