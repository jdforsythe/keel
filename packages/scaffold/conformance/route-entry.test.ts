// Spec: k.scaffold, Generators "`route`: contract entry and binding (k.contract), `*.server.ts` loader, page component, route test; with `--api` (and `--method`, default `GET`) an API entry, its handler and a JSON request test, no component."
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED, apply, errText, esc, lowerName, only, read, scaffoldRaw, snap, withOrders } from "./fixtures.ts";

const routePath = fc
  .tuple(fc.array(lowerName, { minLength: 1, maxLength: 3 }), fc.boolean())
  .map(([segs, param]) => `/${segs.join("/")}${param ? "/:id" : ""}`);

// seed 1337
it("route adds a contract entry, its binding, a component file, a loader and a test, and updates the contract and routes.ts consistently", () => {
  fc.assert(
    fc.property(lowerName, routePath, (name, path) => {
      const id = `orders.${name}`;
      const before = withOrders();
      const out = apply("route", { id, path }, before);
      const routes = read(out.files, only(out.files, /modules\/orders\/routes\.ts$/));
      const contract = read(out.files, only(out.files, /modules\/orders\/orders\.contract\.ts$/));
      expect(routes).toMatch(new RegExp(`['"]${esc(id)}['"]\\s*:`));
      expect(contract).toMatch(new RegExp(`['"]${esc(id)}['"]\\s*:`));
      expect(contract).toContain(path);
      if (path.includes(":id")) expect(contract).toMatch(/params/);
      expect(out.changed).toContain("modules/orders/orders.contract.ts");
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
        p === "modules/orders/orders.contract.ts" ||
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

it("route with `api` and a `method` adds an API entry with that method, a `*.server.ts` handler and a JSON request test, and no component", () => {
  fc.assert(
    fc.property(lowerName, fc.constantFrom("GET", "POST", "PUT", "PATCH", "DELETE"), (name, method) => {
      const id = `orders.${name}`;
      const out = apply("route", { id, path: `/api/${name}`, api: true, method }, withOrders());
      const contract = read(out.files, "modules/orders/orders.contract.ts");
      expect(contract).toMatch(new RegExp(`['"]${esc(id)}['"]\\s*:\\s*\\{[^}]*method:\\s*['"]${method}['"]`));
      expect(out.created.some((p) => /\.server\.ts$/.test(p))).toBe(true);
      expect(out.created.some((p) => /\.test\.tsx?$/.test(p))).toBe(true);
      expect(out.created.some((p) => /\.tsx$/.test(p) && !/\.test\.tsx$/.test(p))).toBe(false);
      const routes = read(out.files, "modules/orders/routes.ts");
      expect(routes).toMatch(
        new RegExp(`['"]${esc(id)}['"]\\s*:\\s*\\{\\s*${method === "GET" ? "loader" : "action"}:`),
      );
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("route with `api` and no `method` adds a GET entry bound to a loader", () => {
  const out = apply("route", { id: "orders.lookup", path: "/api/lookup", api: true }, withOrders());
  expect(read(out.files, "modules/orders/orders.contract.ts")).toMatch(/method:\s*['"]GET['"]/);
  expect(read(out.files, "modules/orders/routes.ts")).toMatch(/['"]orders\.lookup['"]\s*:\s*\{\s*loader:/);
});

// Spec: k.scaffold, Generators "Input `{ id, path, file?, api?, method? }`; `method` is `GET`, `POST`, `PUT`, `PATCH` or `DELETE`, and without `api` it is E1052."
it("route with a `method` and no `api` is E1052 and writes nothing", () => {
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

it("route with a `method` outside GET, POST, PUT, PATCH and DELETE is E1052", () => {
  const r = scaffoldRaw("route", { id: "orders.x", path: "/x", api: true, method: "TRACE" }, withOrders());
  expect(r.ok).toBe(false);
  expect(errText(r)).toContain("E1052");
});

it("route with `file` names the handler or component file it writes", () => {
  const out = apply("route", { id: "orders.pick", path: "/pick", file: "Pick" }, withOrders());
  expect(out.created.some((p) => p.includes("Pick"))).toBe(true);
});
