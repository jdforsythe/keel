// Spec: k.compat, clause "A `service({ module: 'b' })` endpoint in module `a` reports E1152 without `b` in `deps` and E1157 for a route not in `b`'s `public.routes`."
// Seed 1337. Module `y` plays `b` of the clause. Real binary over a temp project (see compat-support.ts).
import { afterAll, expect, test } from "vitest";
import { buildAndCheck, cleanup, diags, materialize, project } from "./compat-support.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const run = (sh: Parameters<typeof project>[0]) => {
  const dir = materialize(project(sh));
  dirs.push(dir);
  return buildAndCheck(dir);
};

test.skip("A `service({ module: 'b' })` endpoint in module `a` reports E1152 without `b` in `deps` and E1157 for a route not in `b`'s `public.routes`.", () => {
  const noDeps = run({ deps: [] });
  expect(diags(noDeps, "E1152").length).toBeGreaterThanOrEqual(1);
  expect(diags(noDeps, "E1152")[0]?.path).toBe("modules/a/api.ts");

  const privateRoute = run({ publicRoutes: [] });
  expect(diags(privateRoute, "E1157").length).toBeGreaterThanOrEqual(1);
  expect(diags(privateRoute, "E1152")).toEqual([]);

  const clean = run({});
  expect(diags(clean, "E1152")).toEqual([]);
  expect(diags(clean, "E1157")).toEqual([]);
});
