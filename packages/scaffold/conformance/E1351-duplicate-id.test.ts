// Clauses: E1351 target id already exists; "Running the same generator twice reports E1351 the second time and writes nothing."
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Files, RUNS, SEED, apply, errText, fresh, lowerName, pascalName, scaffoldRaw, snap } from "./fixtures.ts";

const gens: [Parameters<typeof apply>[0], Record<string, unknown>, () => Files][] = [
  ["project", { name: "shop" }, () => new Map()],
  ["module", { id: "billing" }, fresh],
  ["route", { id: "orders.list", path: "/orders" }, fresh],
  ["component", { id: "orders/OrderTile" }, fresh],
  ["store", { id: "orders.basket" }, fresh],
];

describe("E1351", () => {
  for (const [op, input, mk] of gens) {
    it(`running ${String(op)} twice reports E1351 the second time and writes nothing`, () => {
      const once = apply(op, input, mk()).files;
      const before = snap(once);
      const second = scaffoldRaw(op, input, once);
      expect(second.ok).toBe(false);
      expect(errText(second)).toContain("E1351");
      expect(snap(once)).toBe(before);
    });
  }
  it("E1351 holds for generated ids (clean counterpart: first run succeeds)", () => {
    fc.assert(
      fc.property(lowerName, pascalName, (n, P) => {
        for (const [op, input] of [
          ["module", { id: n }],
          ["component", { id: `orders/${P}` }],
          ["store", { id: `orders.${n}` }],
        ] as const) {
          const first = scaffoldRaw(op, input, fresh());
          expect(first.ok).toBe(true);
          if (first.ok) expect(errText(scaffoldRaw(op, input, first.value.files))).toContain("E1351");
        }
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
