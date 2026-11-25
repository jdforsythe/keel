// Spec: k.scaffold, clause "`scaffold route` with `method` and no `api` is E1052 and writes nothing; with `api` and `method: 'POST'` it adds an API write entry, its binding and its handler."
// Seed 1337 (fast-check).
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED, apply, errText, esc, lowerName, read, scaffoldRaw, snap, withOrders } from "./fixtures.ts";

it("`scaffold route` with `method` and no `api` is E1052 and writes nothing", () => {
  fc.assert(
    fc.property(lowerName, fc.constantFrom("GET", "POST", "PUT", "PATCH", "DELETE"), (name, method) => {
      const files = withOrders();
      const before = snap(files);
      const r = scaffoldRaw("route", { id: `orders.${name}`, path: `/${name}`, method }, files);
      expect(r.ok).toBe(false);
      expect(errText(r)).toContain("E1052");
      expect(snap(files)).toBe(before);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("`scaffold route` with `api` and `method: 'POST'` adds an API write entry, its binding and its handler", () => {
  fc.assert(
    fc.property(lowerName, (name) => {
      const id = `orders.${name}`;
      const out = apply("route", { id, path: `/api/${name}`, api: true, method: "POST" }, withOrders());
      expect(read(out.files, "modules/orders/orders.contract.ts")).toMatch(
        new RegExp(`['"]${esc(id)}['"]\\s*:\\s*\\{[^}]*method:\\s*['"]POST['"]`),
      );
      expect(read(out.files, "modules/orders/routes.ts")).toMatch(
        new RegExp(`['"]${esc(id)}['"]\\s*:\\s*\\{\\s*action:`),
      );
      expect(out.created.some((p) => /\.server\.ts$/.test(p))).toBe(true);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});
