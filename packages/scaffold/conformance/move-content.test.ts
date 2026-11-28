// k.scaffold, Codemods "`move` relocates a file to another module, updating imports and both manifests."
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED, apply, find, isGenerated, only, pascalName, read, withOrders } from "./fixtures.ts";

const body = (src: string) =>
  src
    .split("\n")
    .filter((l) => !/^\s*import\b/.test(l))
    .join("\n");

// seed 1337
it("move keeps content byte-identical apart from import paths", () => {
  fc.assert(
    fc.property(pascalName, (name) => {
      const before = apply("component", { id: `orders/${name}` }, withOrders()).files;
      const from = only(before, new RegExp(`(^|/)${name}\\.tsx$`));
      const out = apply("move", { name, to: "catalog" }, before).files;
      const to = only(out, new RegExp(`(^|/)${name}\\.tsx$`));
      expect(to.startsWith("modules/catalog/")).toBe(true);
      expect(out.has(from)).toBe(false);
      expect(body(read(out, to))).toBe(body(read(before, from)));
      for (const [p, c] of before) {
        if (p === from || isGenerated(p) || p.endsWith("module.ts") || p === "topology.ts") continue;
        expect(body(out.get(p) ?? ""), p).toBe(body(c));
      }
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("move updates both manifests (module.ts files)", () => {
  const before = withOrders();
  const out = apply("move", { name: "OrderCard", to: "catalog" }, before).files;
  expect(find(out, /modules\/catalog\/module\.ts$/).length).toBe(1);
  expect(read(out, "modules/catalog/module.ts")).toContain("OrderCard");
  expect(read(out, "modules/orders/module.ts")).toContain("catalog");
});
