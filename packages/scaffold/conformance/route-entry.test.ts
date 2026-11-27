// k.scaffold, Generators "`route`: contract entry and binding (k.contract), page component, route test (one without `app` passes `identity.ts`'s default export as `mount` when the project has it, k.testing), and a `*.server.ts` loader when a `node` deployable lists the module or `--loader` asks for one (on a `client` deployable it runs in the browser, k.boundary); with `--no-loader`, or by default elsewhere, no loader file and a binding of `component` alone. Without `--path` the path is `/` and the id's segments after the module, each in kebab case, joined by `/` (`app.about` `/about`, `orders.orderHistory` `/order-history`, `orders.list.recent` `/list/recent`), never a param; a derived path another route holds is E1351 naming that route, fix `--path <path>`; with `--api` (and `--method`, default `GET`) an API entry, its handler and a JSON request test, no component. Input `{ id, path?, file?, api?, method?, loader?, 'no-loader'? }`; `method` is `GET`, `POST`, `PUT`, `PATCH` or `DELETE`; `method` without `api`, `loader` or `no-loader` with `api`, or both, is E1052."
// k.scaffold, Generators "`route`: contract entry and binding (k.contract), page component, route test (one without `app` passes `identity.ts`'s default export as `mount` when the project has it, k.testing), and a `*.server.ts` loader when a `node` deployable lists the module or `--loader` asks for one (on a `client` deployable it runs in the browser, k.boundary); with `--no-loader`, or by default elsewhere, no loader file and a binding of `component` alone. Without `--path` the path is `/` and the id's segments after the module, each in kebab case, joined by `/` (`app.about` `/about`, `orders.orderHistory` `/order-history`, `orders.list.recent` `/list/recent`), never a param; an id the contract already holds is E1351 naming that id, not `--path`; a derived path another route holds is E1351 naming that route, fix `--path <path>`; with `--api` (and `--method`, default `GET`) an API entry, its handler and a JSON request test, no component. Input `{ id, path?, file?, api?, method?, loader?, 'no-loader'? }`; `method` is `GET`, `POST`, `PUT`, `PATCH` or `DELETE`; `method` without `api`, `loader` or `no-loader` with `api`, or both, is E1052."
// Spec: k.scaffold, clause "In the default project `route { id: 'app.about' }` binds `/about`, writes no `*.server.ts` and leaves `keel check` and `keel test` clean; with `loader: true` it writes `modules/app/loadAbout.server.ts`; in the `node` project `{ id: 'app.about' }` writes it; `{ id: 'app.start' }` beside a route at `/start` is E1351 holding `--path`; `loader` with `no-loader` is E1052."
import fc from "fast-check";
import { expect, it } from "vitest";
import {
  RUNS,
  SEED,
  apply,
  errText,
  esc,
  fresh,
  lowerName,
  only,
  read,
  scaffoldRaw,
  snap,
  withOrders,
} from "./fixtures.ts";
import { freshNode } from "./service-base-support.ts";

const routePath = fc
  .tuple(fc.array(lowerName, { minLength: 1, maxLength: 3 }), fc.boolean())
  .map(([segs, param]) => `/${segs.join("/")}${param ? "/:id" : ""}`);

// seed 1337
it("route adds a contract entry, its binding, a component file and a test, no loader file on a `client` deployable, and updates the contract and routes.ts consistently", () => {
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
      expect(out.created.some((p) => /\.server\.ts$/.test(p))).toBe(false);
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

// Spec: k.scaffold clause "`scaffold route` with `method` and no `api` is E1052 and writes nothing; with `api` and `method: 'POST'` it adds an API write entry, its binding and its handler."
it("with `api` and `method: 'POST'` route adds an API write entry, its binding and its handler", () => {
  const out = apply("route", { id: "orders.place", path: "/api/place", api: true, method: "POST" }, withOrders());
  expect(read(out.files, "modules/orders/orders.contract.ts")).toMatch(/method:\s*['"]POST['"]/);
  expect(read(out.files, "modules/orders/routes.ts")).toMatch(/['"]orders\.place['"]\s*:\s*\{\s*action:/);
  expect(out.created.some((p) => /\.server\.ts$/.test(p))).toBe(true);
});

const words = fc.stringMatching(/^[a-z]{3,6}$/).map((w) => `zq${w}`);
const cap = (w: string): string => `${w.charAt(0).toUpperCase()}${w.slice(1)}`;
const kebab = (seg: string): string => seg.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// seed 1337
it("Without `--path` the path is `/` and the id's segments after the module, each in kebab case, joined by `/`, never a param", () => {
  fc.assert(
    fc.property(fc.array(fc.array(words, { minLength: 1, maxLength: 2 }), { minLength: 1, maxLength: 3 }), (parts) => {
      const segs = parts.map(([head, ...rest]) => `${head ?? ""}${rest.map(cap).join("")}`);
      const id = `orders.${segs.join(".")}`;
      const expected = `/${segs.map(kebab).join("/")}`;
      const out = apply("route", { id }, fresh());
      const contract = read(out.files, "modules/orders/orders.contract.ts");
      expect(contract).toMatch(new RegExp(`['"]${esc(expected)}['"]`));
      expect(expected).not.toContain(":");
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("`app.about` is `/about`, `orders.orderHistory` is `/order-history` and `orders.list.recent` is `/list/recent`", () => {
  for (const [id, path] of [
    ["app.about", "/about"],
    ["orders.orderHistory", "/order-history"],
    ["orders.list.recent", "/list/recent"],
  ] as const) {
    const out = apply("route", { id }, fresh());
    const contract = [...out.files]
      .filter(([p]) => p.endsWith(".contract.ts"))
      .map(([, c]) => c)
      .join("\n");
    expect(contract, id).toMatch(new RegExp(`['"]${esc(path)}['"]`));
  }
});

it("a derived path another route holds is E1351 naming that route, fix `--path <path>`, and nothing is written", () => {
  fc.assert(
    fc.property(words, (w) => {
      const files = apply("route", { id: "orders.holder", path: `/${w}` }, withOrders()).files;
      const before = snap(files);
      const r = scaffoldRaw("route", { id: `orders.${w}` }, files);
      expect(r.ok).toBe(false);
      expect(errText(r)).toContain("E1351");
      expect(errText(r)).toContain("orders.holder");
      expect(errText(r)).toContain("--path");
      expect(snap(files)).toBe(before);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("In the default project `route { id: 'app.about' }` binds `/about` and writes no `*.server.ts`; with `loader: true` it writes `modules/app/loadAbout.server.ts`", () => {
  const plain = apply("route", { id: "app.about" }, fresh());
  expect(plain.created.some((p) => /\.server\.ts$/.test(p))).toBe(false);
  expect(read(plain.files, "modules/app/app.contract.ts")).toMatch(/['"]\/about['"]/);
  const withLoader = apply("route", { id: "app.about", loader: true }, fresh());
  expect(withLoader.created).toContain("modules/app/loadAbout.server.ts");
});

it("in the `node` project `{ id: 'app.about' }` writes `modules/app/loadAbout.server.ts`", () => {
  expect(apply("route", { id: "app.about" }, freshNode()).created).toContain("modules/app/loadAbout.server.ts");
});

it("`{ id: 'app.start' }` beside a route at `/start` is E1351 holding `--path`", () => {
  const files = apply("route", { id: "app.begin", path: "/start" }, fresh()).files;
  const r = scaffoldRaw("route", { id: "app.start" }, files);
  expect(r.ok).toBe(false);
  expect(errText(r)).toContain("E1351");
  expect(errText(r)).toContain("app.begin");
  expect(errText(r)).toContain("--path");
});

it("an id the contract already holds is E1351 naming that id, not `--path`", () => {
  fc.assert(
    fc.property(lowerName, routePath, routePath, (name, p1, p2) => {
      const id = `orders.${name}`;
      const files = apply("route", { id, path: p1 }, withOrders()).files;
      const r = scaffoldRaw("route", { id, path: p2 }, files);
      expect(r.ok).toBe(false);
      expect(errText(r)).toContain("E1351");
      expect(errText(r)).toContain(id);
      expect(errText(r)).not.toContain("--path");
    }),
    { seed: 1337, numRuns: RUNS },
  );
});

it("`loader` with `no-loader` is E1052 and writes nothing", () => {
  const files = fresh();
  const before = snap(files);
  const r = scaffoldRaw("route", { id: "app.about", loader: true, "no-loader": true }, files);
  expect(r.ok).toBe(false);
  expect(errText(r)).toContain("E1052");
  expect(snap(files)).toBe(before);
});

it("`loader` or `no-loader` with `api` is E1052", () => {
  for (const flag of ["loader", "no-loader"] as const) {
    const r = scaffoldRaw("route", { id: "orders.x", path: "/api/x", api: true, [flag]: true }, withOrders());
    expect(r.ok, flag).toBe(false);
    expect(errText(r), flag).toContain("E1052");
  }
});
