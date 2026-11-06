// Clause: k.scaffold generators — `route`: manifest entry, *.server.ts loader, page component, route test.
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED, apply, esc, lowerName, only, read, withOrders } from "./fixtures.ts";

const routePath = fc
  .tuple(fc.array(lowerName, { minLength: 1, maxLength: 3 }), fc.boolean())
  .map(([segs, param]) => `/${segs.join("/")}${param ? "/:id" : ""}`);

// seed 1337
it("route adds a manifest entry, a component file, a loader and a test, and updates routes.ts consistently", () => {
  fc.assert(
    fc.property(lowerName, routePath, (name, path) => {
      const id = `orders.${name}`;
      const before = withOrders();
      const out = apply("route", { id, path }, before);
      const routes = read(out.files, only(out.files, /modules\/orders\/routes\.ts$/));
      expect(routes).toMatch(new RegExp(`['"]${esc(id)}['"]\\s*:`));
      expect(routes).toContain(path);
      if (path.includes(":id")) expect(routes).toMatch(/params/);
      expect(out.created.some((p) => /\.tsx$/.test(p))).toBe(true);
      expect(out.created.some((p) => /\.server\.ts$/.test(p))).toBe(true);
      expect(out.created.some((p) => /\.test\.tsx?$/.test(p))).toBe(true);
      expect(out.changed).toContain("modules/orders/routes.ts");
      // the previous routes survive
      expect(routes).toContain("orders.show");
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("route id appears in exactly the right files: its module's, its own, and generated artifacts only", () => {
  fc.assert(
    fc.property(lowerName, routePath, (name, path) => {
      const id = `orders.${name}`;
      const out = apply("route", { id, path }, withOrders());
      const allowed = (p: string) =>
        p === "modules/orders/routes.ts" ||
        p === "modules/orders/module.ts" ||
        out.created.includes(p) ||
        p.startsWith(".keel/");
      for (const [p, c] of out.files) {
        if (c.includes(id)) expect(allowed(p), p).toBe(true);
        if (p.startsWith("modules/catalog/")) expect(c, p).not.toContain(id);
      }
      expect(out.files.get("modules/orders/routes.ts")).toContain(id);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});
