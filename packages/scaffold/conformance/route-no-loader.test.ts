// Spec: k.scaffold, clause "`route { id: 'orders.about', path: '/about', 'no-loader': true }` creates the page component and the route test alone, adds the contract entry, and binds `'orders.about'` to `{ component }`: no `*.server.ts` file is created and `routes.ts` gains no loader import; `keel check` and `keel test` are clean in the default and the `node` project. With `api: true` it is E1052, nothing written."
// seed 1337 (property over route names and paths).
import { fixedTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { RUNS, SEED, apply, errText, esc, fresh, lowerName, read, scaffoldRaw, snap } from "./fixtures.ts";
import { cleanup, materialize } from "./keel-cli.ts";
import { expectCheckAndTestClean, freshNode, testFileCount } from "./service-base-support.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

const routePath = fc
  .tuple(fc.array(lowerName, { minLength: 1, maxLength: 3 }), fc.boolean())
  .map(([segs, param]) => `/${segs.join("/")}${param ? "/:id" : ""}`);

/** The `{ component }` binding of `id` in routes.ts: one property, no loader. */
const bindingOf = (id: string): RegExp =>
  new RegExp(`["']${esc(id)}["']\\s*:\\s*\\{\\s*component(?:\\s*:\\s*\\w+)?\\s*,?\\s*\\}`);

const projects: [string, () => ReturnType<typeof fresh>][] = [
  ["default", fresh],
  ["node", freshNode],
];

for (const [name, mk] of projects) {
  describe(`route 'no-loader': true in the ${name} project`, () => {
    it("creates the page component and the route test alone, adds the contract entry, binds { component }, writes no *.server.ts", () => {
      fc.assert(
        fc.property(lowerName, routePath, (n, path) => {
          const id = `orders.${n}`;
          const project = mk();
          const held = new Set(project.keys());
          const out = apply("route", { id, path, "no-loader": true }, project);
          expect(out.created).toHaveLength(2);
          expect(out.created.filter((p) => /\.tsx$/.test(p) && !/\.test\.tsx$/.test(p))).toHaveLength(1);
          expect(out.created.filter((p) => /\.test\.tsx?$/.test(p))).toHaveLength(1);
          expect(out.created.filter((p) => /\.server\.tsx?$/.test(p))).toEqual([]);
          // the node project holds its own `modules/app/loadHome.server.ts`; the route adds none
          expect([...out.files.keys()].filter((p) => !held.has(p) && /\.server\.tsx?$/.test(p))).toEqual([]);
          expect(out.changed).toContain("modules/orders/orders.contract.ts");
          expect(out.changed).toContain("modules/orders/routes.ts");
          expect(read(out.files, "modules/orders/orders.contract.ts")).toMatch(new RegExp(`["']${esc(id)}["']\\s*:`));
          const routes = read(out.files, "modules/orders/routes.ts");
          expect(routes).toMatch(bindingOf(id));
          expect(routes).not.toMatch(/\.server/);
          expect(routes).not.toMatch(/loader/);
        }),
        { seed: SEED, numRuns: RUNS },
      );
    });
    it(
      "orders.about at /about leaves keel check and keel test clean",
      () => {
        const out = apply("route", { id: "orders.about", path: "/about", "no-loader": true }, mk());
        expect(out.created.filter((p) => /\.server\.tsx?$/.test(p))).toEqual([]);
        expect(read(out.files, "modules/orders/routes.ts")).toMatch(bindingOf("orders.about"));
        const tree = out.files;
        const dir = materialize(tree);
        dirs.push(dir);
        expectCheckAndTestClean(dir, testFileCount(tree));
      },
      fixedTime(120000),
    );
    it("with api: true it is E1052 and writes nothing", () => {
      fc.assert(
        fc.property(lowerName, routePath, (n, path) => {
          const f = mk();
          const before = snap(f);
          const r = scaffoldRaw("route", { id: `orders.${n}`, path, api: true, "no-loader": true }, f);
          expect(r.ok).toBe(false);
          expect(errText(r)).toContain("E1052");
          expect(snap(f)).toBe(before);
        }),
        { seed: SEED, numRuns: RUNS },
      );
    });
  });
}
