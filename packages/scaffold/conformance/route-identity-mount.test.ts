// Spec: k.scaffold, clause "With `identity.ts` beside `topology.ts` and `orders` on a `client` deployable, `route { id: 'orders.about', path: '/about' }` writes a route test that imports `identity.ts`'s default export as `mount` and passes it to `renderRoute`; `keel check` reports no E1730 and `keel test` passes it. In the default project it holds no `mount`."
// k.scaffold, Generators "`route`: contract entry and binding (k.contract), `*.server.ts` loader, page component, route test (one without `app` passes `identity.ts`'s default export as `mount` when the project has it, k.testing); with `--no-loader` no loader file, and a binding of `component` alone; with `--api` (and `--method`, default `GET`) an API entry, its handler and a JSON request test, no component. Input `{ id, path, file?, api?, method?, 'no-loader'? }`; `method` is `GET`, `POST`, `PUT`, `PATCH` or `DELETE`; `method` without `api`, or `no-loader` with `api`, is E1052."
// Seed 1337 (fc.assert below). The first group is pure (`scaffold` over a file map); the second runs the real `keel` binary over a materialized tree.
// ASSUMPTIONS: the identity project is the default project with `topology.ts` rewritten to a `client` deployable `web` (orders, catalog) served by a `node` deployable `api` (a module `gate`), plus `identity.ts` and `identity.server.ts` (E1589 otherwise); "in the default project" is `fresh()`, which has no `identity.ts`; the route test is the one created `.test.ts(x)` file, and `--no-loader` and `--api` routes are not part of this clause.
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RUNS, SEED, apply, esc, fresh, lowerName, read, rel } from "./fixtures.ts";
import { cleanup, keel, materialize, readTree } from "./keel-cli.ts";
import { BOUND } from "./shell-support.ts";

const TOPOLOGY = `import { topology } from "@keel/server"
export default topology({
  web: { modules: ["orders", "catalog"], adapter: "client", servedBy: "api" },
  api: { modules: ["gate"], adapter: "node" },
})
`;
const IDENTITY = `import { identityMount } from "@keel/router"
export default identityMount("/api/auth")
`;
const IDENTITY_SERVER = `import { identity } from "@keel/server"
import mount from "./identity.ts"
export default identity({ identify: async () => "", handle: { path: mount.path, fn: () => new Response("") } })
`;

const HOME_TEST = `import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";
import mount from "../../identity.ts";
import { routes } from "./routes.ts";

it("shows the project's name as the home page's heading", async () => {
  const page = await renderRoute("app.home", { routes, params: {}, mount });
  expect(page.find("app.home.title").text).toBe("shop");
  page.dispose();
});
`;
function identityProject(): Map<string, string> {
  const files = apply("module", { id: "gate" }, fresh()).files;
  files.set("topology.ts", TOPOLOGY);
  files.set("identity.ts", IDENTITY);
  files.set("identity.server.ts", IDENTITY_SERVER);
  // The project's own home route test is a route test of an identity project too: it passes identity.ts's default export as `mount`.
  files.set("modules/app/home.route.test.ts", HOME_TEST);
  return files;
}
const testOf = (created: readonly string[]): string => {
  const hits = created.filter((p) => /\.test\.tsx?$/.test(p));
  const [first] = hits;
  if (hits.length !== 1 || first === undefined) throw new Error(`expected one route test, got ${JSON.stringify(hits)}`);
  return first;
};
const mountImport = (path: string): RegExp =>
  new RegExp(`import\\s+mount\\s+from\\s+["']${esc(rel(path, "identity.ts"))}["']`);
const routeOptions = (src: string): string => /renderRoute\([^,]+,\s*(\{[\s\S]*?\})\s*\)/.exec(src)?.[1] ?? "";

describe("k.scaffold: route in a project with identity.ts", () => {
  it("route { id: 'orders.about', path: '/about' } writes a route test that imports identity.ts's default export as mount and passes it to renderRoute", () => {
    const out = apply("route", { id: "orders.about", path: "/about" }, identityProject());
    const path = testOf(out.created);
    const src = read(out.files, path);
    expect(src).toMatch(mountImport(path));
    expect(routeOptions(src)).toMatch(/\bmount\b/);
    expect(routeOptions(src)).not.toMatch(/\bapp\b/);
  });

  it("for any route id and path of a module on a client deployable, the route test imports mount from identity.ts and passes it, with no app", () => {
    fc.assert(
      fc.property(
        lowerName,
        fc.array(lowerName, { minLength: 1, maxLength: 3 }),
        fc.constantFrom("orders", "catalog"),
        (name, segs, mod) => {
          const out = apply("route", { id: `${mod}.${name}`, path: `/${segs.join("/")}` }, identityProject());
          const path = testOf(out.created);
          const src = read(out.files, path);
          expect(src).toMatch(mountImport(path));
          expect(routeOptions(src)).toMatch(/\bmount\b/);
          expect(routeOptions(src)).not.toMatch(/\bapp\b/);
        },
      ),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("in the default project the route test holds no mount", () => {
    fc.assert(
      fc.property(lowerName, fc.array(lowerName, { minLength: 1, maxLength: 3 }), (name, segs) => {
        const out = apply("route", { id: `orders.${name}`, path: `/${segs.join("/")}` }, fresh());
        const src = read(out.files, testOf(out.created));
        expect(src).not.toMatch(/\bmount\b/);
        expect(src).not.toContain("identity");
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("the identity-project route test is the only file whose text differs from the default project's by the mount", () => {
    const withId = apply("route", { id: "orders.about", path: "/about" }, identityProject());
    const plain = apply("route", { id: "orders.about", path: "/about" }, fresh());
    expect([...withId.created].sort()).toEqual([...plain.created].sort());
    for (const p of plain.created) {
      if (/\.test\.tsx?$/.test(p)) continue;
      expect(read(withId.files, p)).toBe(read(plain.files, p));
    }
  });
});

describe("k.scaffold: the route test of an identity project under the real binary", () => {
  let dir = "";
  let checked: ReturnType<typeof keel> = { status: null, records: [] };
  let tested: ReturnType<typeof keel> = { status: null, records: [] };
  beforeAll(() => {
    const out = apply("route", { id: "orders.about", path: "/about" }, identityProject());
    dir = materialize(out.files);
    checked = keel(dir, ["check"]);
    tested = keel(dir, ["test"]);
  }, BOUND * 2);
  afterAll(() => cleanup(dir));

  it("keel check reports no E1730", () => {
    expect(readTree(dir).has("identity.ts")).toBe(true);
    expect(checked.records.filter((r) => r.kind === "diag" && r.code === "E1730")).toEqual([]);
  });

  it("keel test passes the route test", () => {
    expect(tested.status).toBe(0);
    expect(tested.records.find((r) => r.kind === "summary")).toMatchObject({ ok: true });
  });
});
