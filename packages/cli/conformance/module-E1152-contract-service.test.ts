// k.module Rules, E1152 "import from a module not in `deps`"; k.contract "importing the contract needs `deps` only (E1152), never `public.exports`."
// Seed 1337. Module `y` plays `b`: module `a` calls it with `service({ contract: y })`. Real binary over a temp project (see compat-support.ts).
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

test("A `service({ contract })` over module `b`'s contract in module `a` reports E1152 without `b` in `deps`, and no E1151 or E1157 with it although `b`'s `public.exports` omits the contract.", () => {
  const noDeps = run({ deps: [] });
  expect(diags(noDeps, "E1152").length).toBeGreaterThanOrEqual(1);
  expect(diags(noDeps, "E1152")[0]?.path).toBe("modules/a/api.ts");

  const clean = run({});
  expect(diags(clean, "E1152")).toEqual([]);
  expect(diags(clean, "E1151")).toEqual([]);
  expect(diags(clean, "E1157")).toEqual([]);
});
